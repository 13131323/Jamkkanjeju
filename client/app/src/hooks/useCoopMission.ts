import { replaceEqualDeep, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { COOP_STEP, type CoopMissionProgressResponse, type JoinCoopMissionResponse, type RoleCard, type RoleProgress } from '@packages/shared';
import { useCoopSimulationEnabled } from '@/config/coopSimulation';
import {
  getGetCooperativeMissionStatusApiV1CooperativeMissionsMissionProgressIdProgressGetQueryKey as coopStatusQueryKey,
  useAcceptJoinRequestApiV1CooperativeMissionsMissionProgressIdParticipantsParticipantIdAcceptPatch as useAcceptJoinRequestMutation,
  useGetCooperativeMissionStatusApiV1CooperativeMissionsMissionProgressIdProgressGet as useCoopStatusQuery,
  useJoinCooperativeMissionApiV1CooperativeMissionsJoinRequestsPost as useJoinCoopMissionMutation,
  useLeaveCooperativeMissionApiV1CooperativeMissionsMissionProgressIdParticipantsMeDelete as useLeaveCoopMissionMutation,
  useRejectJoinRequestApiV1CooperativeMissionsMissionProgressIdParticipantsParticipantIdDelete as useRejectJoinRequestMutation,
  useSaveCooperativeMissionProgressApiV1CooperativeMissionsMissionProgressIdProgressPatch as useSaveCoopProgressMutation,
  useSaveRoleAssignmentApiV1CooperativeMissionsMissionProgressIdRoleAssignmentsRoleCardIdPut as useSaveRoleAssignmentMutation,
  useStartCooperativeMissionApiV1CooperativeMissionsCooperativeMissionIdProgressPost as useStartCoopMissionMutation,
  useVerifyRoleProgressApiV1CooperativeMissionsMissionProgressIdRoleProgressesRoleProgressIdVerificationPost as useVerifyRoleProgressMutation,
} from '@/services/api/cooperative-mission/cooperative-mission';
import { useCurrentCoordsOnce } from '@/hooks/useCurrentCoordsOnce';
import { useCoopPartyStore } from '@/store/coopParty';
import { isSimulatedParticipant, realParticipants, simulateCoopStatus, simulateParticipants } from '@/utils/coopDevSimulation';
import { describeApiError } from '@/utils/apiError';
import { resolveCoopFailure, shouldRetryCoopStatus, type CoopFailure } from '@/utils/coopFailure';
import { remainingRoleAssignTargets } from '@/utils/coopRole';
import { randomRoleAssignments } from '@/utils/coopRoleAssignment';
import { mergeCoopStatus } from '@/utils/coopStatusMerge';
import { coopPollIntervalMs, isCoopAssigningRoles } from '@/utils/coopStep';
import { coopTrace } from '@/utils/coopTrace';
import { activeParticipants, findHost, soleParticipantId } from '@/utils/party';

/**
 * 협동 미션의 서버 연결 한 곳.
 *
 * 화면은 생성 훅(이름이 경로 전체인 orval 산출물)을 직접 부르지 않고 여기서만 부른다.
 * 협동 미션은 **여러 사람이 같은 방을 동시에 본다**는 점이 다른 미션과 다르고,
 * 그래서 "무엇을 바꾸든 곧바로 상태를 다시 읽는다"는 규칙이 화면마다 흩어지면 안 된다.
 */

/**
 * 앱이 지금 화면에 떠 있는지.
 *
 * **react-query의 `refetchIntervalInBackground`로는 이 판단을 할 수 없다.** RN에는
 * `visibilitychange` 이벤트가 없어 focusManager가 리스너를 하나도 걸지 못하고,
 * `isFocused()`가 `globalThis.document?.visibilityState !== 'hidden'`으로 떨어져 **항상 true**다
 * (@tanstack/query-core focusManager.js). 그래서 그 옵션을 어떻게 두든 앱을 내려 둔 동안에도
 * 2초 폴링이 계속 돌아 요청만 쌓였다.
 *
 * focusManager 자체를 AppState에 연결하는 방법도 있지만 그것은 앱의 **모든 쿼리**를 바꾼다.
 * 지금 문제인 것은 2초짜리 이 폴링 하나라 여기서만 막는다.
 */
function useAppForeground(): boolean {
  const [foreground, setForeground] = useState(() => AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  return foreground;
}

/**
 * 방을 바꾸는 동작의 결과.
 *
 * 실패를 던지지 않고 값으로 돌려준다 — 협동 미션의 실패는 예외 상황이 아니라 정상 흐름의 일부다
 * (방이 사라짐, 정원 초과, 이미 지난 단계). 예외로 다루면 호출부마다 try/catch가 붙고
 * 한 곳이라도 빠지면 처리되지 않은 rejection이 되어 앱이 그대로 깨진다.
 */
export type CoopActionResult = { ok: true } | { ok: false; failure: CoopFailure; detail?: string };

/**
 * 사진 인증 결과.
 *
 * `ok`(요청이 처리됐는가)와 `verified`(사진이 역할에 맞았는가)는 다른 축이다 —
 * 인증 실패는 오류가 아니라 판정 결과라 서버가 `200`으로 준다.
 */
export type CoopVerifyResult = { ok: true; verified: boolean } | { ok: false; failure: CoopFailure; detail?: string };

/** 폴링이 아직 한 번도 성공하지 않았을 때 화면이 쓰는 빈 값. 매번 새 배열을 만들지 않는다 */
const NO_ROLE_PROGRESSES: RoleProgress[] = [];

/**
 * 방 상태 폴링 + 방을 바꾸는 모든 동작.
 *
 * 반환하는 동작들은 전부 성공 시 상태 쿼리를 **즉시** 무효화한다. 서버가 변경 결과를
 * 응답 본문에 담아 주지 않기 때문에, 다음 폴링(최대 2초)을 기다리면 방금 누른 버튼이
 * 아무 일도 안 한 것처럼 보인다.
 */
export function useCoopMissionRoom() {
  const queryClient = useQueryClient();

  const missionProgressId = useCoopPartyStore((state) => state.missionProgressId);
  const myParticipantId = useCoopPartyStore((state) => state.myParticipantId);
  const previousParticipants = useCoopPartyStore((state) => state.previousParticipants);
  const storedRoleCards = useCoopPartyStore((state) => state.roleCards);
  const storedParticipants = useCoopPartyStore((state) => state.participants);
  const acceptedSimulatedIds = useCoopPartyStore((state) => state.acceptedSimulatedIds);
  const rejectedSimulatedIds = useCoopPartyStore((state) => state.rejectedSimulatedIds);
  const setMyParticipantId = useCoopPartyStore((state) => state.setMyParticipantId);
  const rememberParticipants = useCoopPartyStore((state) => state.rememberParticipants);
  const acceptSimulated = useCoopPartyStore((state) => state.acceptSimulated);
  const rejectSimulated = useCoopPartyStore((state) => state.rejectSimulated);

  /**
   * 상태 조회에 실어 보낼 좌표.
   *
   * **서버가 필수로 요구한다.** 빠뜨리면 `400 INVALID_REQUEST`로 폴링이 통째로 막히고,
   * 그러면 `currentStep`을 영원히 못 받아 단계가 올라가도 화면이 그 자리에 멈춘다.
   * 4단계의 다음 장소 거리(`distanceMeter`)도 이 좌표로 계산된다.
   *
   * 권한은 미션 인트로가 이미 받아 뒀다. 좌표를 못 읽으면 폴링을 시작하지 않는다 —
   * 아무 값이나 넣어 보내면 엉뚱한 곳을 기준으로 거리가 계산된다.
   */
  const coords = useCurrentCoordsOnce(missionProgressId !== null);

  const foreground = useAppForeground();

  const statusQuery = useCoopStatusQuery(missionProgressId ?? 0, coords === null ? { latitude: 0, longitude: 0 } : { latitude: coords.lat, longitude: coords.lng }, {
    query: {
      enabled: missionProgressId !== null && coords !== null,
      /**
       * 간격 판단은 `coopPollIntervalMs` 한 곳에 있다(완료 단계 · 포그라운드 여부 · 429 백오프).
       *
       * 429는 `state.error`로 본다. 재시도를 끄는 것만으로는 부족하다 — 그러면 2초 뒤 다음
       * 주기가 그대로 돌아 같은 속도로 계속 두드리게 된다. 다음 응답이 성공하면 error가 지워져
       * 간격은 저절로 2초로 돌아온다.
       */
      refetchInterval: (query) => coopPollIntervalMs(query.state.data?.currentStep, { foreground, rateLimited: resolveCoopFailure(query.state.error) === 'rate-limited' }),
      // 방이 사라졌거나 429면 다시 물어도 같은 답이다. 기본 재시도(3회)를 두면 2초 폴링이 실패마다 요청을 쌓는다.
      retry: shouldRetryCoopStatus,
      /**
       * **응답 내용이 바뀔 때만** 화면을 다시 그린다.
       *
       * 폴링은 2초마다 도는데 그때마다 `isFetching`·`fetchStatus`·`dataUpdatedAt`이 오르내린다.
       * 그 변화까지 구독하면 값이 하나도 안 바뀌어도 화면이 계속 다시 그려진다 — 초대 화면에서는
       * 그 재렌더 때문에 참여 멤버 목록의 스크롤이 맨 위로 되돌아갔다(기기에서 확인).
       *
       * 여기 적은 셋은 이 훅이 실제로 읽는 값 전부다. `data`는 structuralSharing이 내용이 같으면
       * 이전 참조를 그대로 돌려주므로(위 replaceEqualDeep) 값이 같은 폴링은 알림 자체가 없다.
       */
      notifyOnChangeProps: ['data', 'error', 'isError'],
      // 폴링 응답은 단계별로 필드를 null로 비운다(4단계에는 참여자가 없다). 그대로 덮어쓰면
      // 화면에서 목록이 사라지므로 직전 값을 이월한 뒤, 내용이 같으면 이전 참조를 유지한다.
      structuralSharing: (previous, incoming) => {
        const merged = mergeCoopStatus((previous as CoopMissionProgressResponse | undefined) ?? null, incoming as CoopMissionProgressResponse);
        return replaceEqualDeep(previous, merged);
      },
    },
  });

  const simulationEnabled = useCoopSimulationEnabled();
  const rawStatus = statusQuery.data ?? null;

  /**
   * 화면이 읽는 방 상태.
   *
   * 시뮬레이션이 꺼져 있으면 폴링 응답 그대로다 — `simulateCoopStatus`가 같은 참조를 돌려주고
   * 거절 목록도 비어 있어 이 useMemo는 서버 값을 손대지 않는다.
   */
  const status = useMemo(() => {
    if (rawStatus === null) return null;

    const simulated = simulateCoopStatus(rawStatus, { acceptedSimIds: acceptedSimulatedIds, rejectedSimIds: rejectedSimulatedIds, fallbackRoleCards: storedRoleCards, enabled: simulationEnabled });
    if (rejectedSimulatedIds.length === 0) return simulated;

    // 거절한 가짜 팀원은 목록에서 지운다. 서버에 보낼 수 없는 거절이라 여기서만 반영된다.
    return {
      ...simulated,
      participants: (simulated.participants ?? []).filter((participant) => !rejectedSimulatedIds.includes(participant.participantId)),
      roleProgresses: (simulated.roleProgresses ?? []).filter((progress) => !rejectedSimulatedIds.includes(progress.participantId)),
    };
  }, [rawStatus, acceptedSimulatedIds, rejectedSimulatedIds, storedRoleCards, simulationEnabled]);

  // 첫 폴링은 최대 2초 뒤에 온다. 그동안 방 생성·이어하기 응답이 준 목록으로 화면을 채운다 —
  // 안 그러면 "시작하기" 직후 참여 멤버에 자기 자신도 보이지 않는다.
  //
  // 시뮬레이션을 여기서 한 번 더 태우는 이유: 위 useMemo는 폴링 응답이 있을 때만 돌아서,
  // 응답 전(또는 폴링이 계속 실패하는 동안)에는 가짜 팀원이 아예 안 붙는다.
  // 이미 붙어 있으면 같은 참조를 그대로 돌려주므로 폴링 경로에서 두 번 붙지 않는다.
  const participants = useMemo(
    () => simulateParticipants(status?.participants ?? storedParticipants, acceptedSimulatedIds, rejectedSimulatedIds, simulationEnabled),
    [status?.participants, storedParticipants, acceptedSimulatedIds, rejectedSimulatedIds, simulationEnabled],
  );
  const roleProgresses = status?.roleProgresses ?? NO_ROLE_PROGRESSES;
  const currentStep = status?.currentStep ?? null;
  // 1단계 폴링 응답에는 역할 카드가 없다. 방 생성 응답에서 받아 둔 값이 그 구멍을 메운다.
  const roleCards: RoleCard[] = status?.roleCards ?? storedRoleCards;

  // 폴링이 조용히 실패하면 "가짜 팀원이 안 보인다"와 "서버 응답을 못 받고 있다"가 화면에서
  // 똑같이 보인다(`retryable` 실패는 토스트도 이동도 없다). 그 둘을 로그에서 가른다.
  const statusIsError = statusQuery.isError;
  const statusErrorDetail = statusIsError ? describeApiError(statusQuery.error) : null;
  useEffect(() => {
    if (statusErrorDetail === null) return;
    coopTrace('폴링:실패', { missionProgressId, detail: statusErrorDetail });
  }, [statusErrorDetail, missionProgressId]);

  // 서버가 Bearer 토큰으로 식별해 준 내 참여자 id. 클라이언트가 추측하지 않는다.
  const serverParticipantId = status?.currentParticipant?.participantId ?? null;
  useEffect(() => {
    if (serverParticipantId !== null) setMyParticipantId(serverParticipantId);
  }, [serverParticipantId, setMyParticipantId]);

  /**
   * 방 상태를 **지금 곧바로** 다시 읽는다.
   *
   * 방을 바꾸는 동작(수락·거절·역할 배정·단계 이동·나가기)은 성공하자마자 이걸 부른다 —
   * 서버가 변경 결과를 응답 본문에 담아 주지 않아서, 다음 폴링(최대 2초)을 기다리면 방금 누른
   * 버튼이 아무 일도 안 한 것처럼 보인다. 폴링은 **남이 바꾼 것**을 알기 위한 것이고,
   * 이 재조회는 **내가 바꾼 것**을 즉시 반영하기 위한 것이라 둘 다 필요하다.
   */
  const refreshStatus = useCallback(async () => {
    if (missionProgressId === null) return;
    // 좌표를 빼고 무효화한다. 생성된 키는 [url, params] 이고 react-query는 접두사로 맞추므로
    // 좌표가 달라져도(측위가 갱신돼도) 같은 방의 캐시를 모두 잡는다.
    //
    // `cancelRefetch: true`가 핵심이다. 2초 폴링이 늘 돌고 있어서 이 재조회를 부르는 순간
    // **이미 요청이 날아가 있는 경우가 잦은데**, 기본값(false)이면 react-query가 새로 보내지 않고
    // 그 요청의 응답을 그대로 돌려준다. 그런데 그 요청은 우리가 단계를 올리기 **전에** 나갔으므로
    // 옛 단계가 담겨 있다 — "다음"을 눌러도 화면이 그대로 있다가 다음 폴링(최대 2초)에야 넘어가던
    // 증상이 이것이다. 진행 중인 요청을 버리고 지금 상태를 다시 묻는다.
    await queryClient.invalidateQueries({ queryKey: coopStatusQueryKey(missionProgressId) }, { cancelRefetch: true });
    coopTrace('상태:재조회 완료', { missionProgressId });
  }, [queryClient, missionProgressId]);

  /**
   * 앱으로 **돌아온 순간** 한 번 다시 읽는다.
   *
   * 백그라운드에서는 폴링을 세우므로(위 `coopPollIntervalMs`) 그동안의 변화 — 팀원의 인증,
   * 방장 승계, 단계 이동 — 를 하나도 받지 못한 상태다. 다음 주기를 기다리면 그 2초 동안
   * 화면이 앱을 내려놓기 전의 옛 방을 보여 준다.
   *
   * 처음 마운트에서는 돌지 않는다. 그때는 쿼리가 스스로 첫 요청을 보내므로 여기서 한 번 더
   * 부르면 같은 요청이 두 번 나간다.
   */
  const wasForegroundRef = useRef(foreground);
  useEffect(() => {
    const returned = foreground && !wasForegroundRef.current;
    wasForegroundRef.current = foreground;
    if (returned) void refreshStatus();
  }, [foreground, refreshStatus]);

  const acceptMutation = useAcceptJoinRequestMutation();
  const rejectMutation = useRejectJoinRequestMutation();
  const saveProgressMutation = useSaveCoopProgressMutation();
  const saveRoleAssignmentMutation = useSaveRoleAssignmentMutation();
  const verifyRoleMutation = useVerifyRoleProgressMutation();
  const leaveMutation = useLeaveCoopMissionMutation();

  const acceptParticipant = useCallback(
    async (participantId: number): Promise<CoopActionResult> => {
      // 가짜 팀원은 서버에 없다. 수락 요청을 보내면 404가 난다.
      if (isSimulatedParticipant(participantId)) {
        acceptSimulated(participantId);
        return { ok: true };
      }
      if (missionProgressId === null) return { ok: false, failure: 'retryable' };

      try {
        coopTrace('수락:요청', { missionProgressId, participantId });
        await acceptMutation.mutateAsync({ missionProgressId, participantId });
        await refreshStatus();
        return { ok: true };
      } catch (error) {
        // 결과를 값으로 돌려준다. 예전에는 그냥 await만 해서, 서버가 거절하면
        // 처리되지 않은 rejection이 되어 화면이 통째로 깨졌다.
        coopTrace('수락:실패', { participantId, detail: describeApiError(error) });
        return { ok: false, failure: resolveCoopFailure(error), detail: describeApiError(error) };
      }
    },
    [acceptMutation, acceptSimulated, missionProgressId, refreshStatus],
  );

  const rejectParticipant = useCallback(
    async (participantId: number): Promise<CoopActionResult> => {
      if (isSimulatedParticipant(participantId)) {
        rejectSimulated(participantId);
        return { ok: true };
      }
      if (missionProgressId === null) return { ok: false, failure: 'retryable' };

      try {
        coopTrace('거절:요청', { missionProgressId, participantId });
        await rejectMutation.mutateAsync({ missionProgressId, participantId });
        await refreshStatus();
        return { ok: true };
      } catch (error) {
        coopTrace('거절:실패', { participantId, detail: describeApiError(error) });
        return { ok: false, failure: resolveCoopFailure(error), detail: describeApiError(error) };
      }
    },
    [rejectMutation, rejectSimulated, missionProgressId, refreshStatus],
  );

  /**
   * 초대 "다음" — 역할을 랜덤으로 나눠 **전부 저장한 뒤에** 재료 찾기로 넘긴다.
   *
   * 역할 선택 화면이 없어져 배정이 여기서 한 번에 일어난다. 순서가 중요하다:
   *
   *   랜덤 매칭 → 참여자마다 PUT role-assignments → PATCH progress(2단계) → PATCH progress(3단계)
   *   → 상태 다시 읽기
   *
   * **3단계까지 올려야 한다.** 사진 인증 API가 `current_step`이 3이 아니면
   * `409 COOPERATIVE_MISSION_STEP_NOT_ALLOWED`로 거절한다 — 2단계에 멈춘 방은 아무도 인증을
   * 못 한다. 2를 건너뛰지 않는 이유는 서버 단계 정의(2 = 역할 배정, 3 = 미션 수행)를 그대로
   * 따라가기 위해서다. 배정이 방금 끝났으므로 2를 지나는 것이 맞고, 서버가 순차 전이를
   * 검사하더라도 안전하다.
   *
   * **그 사이의 2단계가 화면을 넘기지 않는다.** 폴링이 중간의 2단계를 먼저 읽어도 모두 초대
   * 화면에 머문다 — 2단계는 초대 화면에 매핑돼 있다(coopStep.ts의 `coopScreenForStep`).
   * 예전에는 2와 3이 모두 재료 찾기여서, 이 함수가 아직 배정을 저장하는 중인데 팀원들이
   * **역할이 비어 있는 재료 찾기 화면**으로 먼저 넘어갔다(그 시점 응답은 `roleProgresses: []`다).
   * 그래도 배정은 여전히 순차로 기다린다 — 한꺼번에 던지면 하나가 실패했을 때 어디까지 저장됐는지
   * 알 수 없고, 서버도 진행도 row를 잠그고 처리하므로 동시 요청이 이득이 아니다.
   *
   * 화면 이동은 여기서 하지 않는다. `currentStep`이 바뀐 것을 보고 초대 화면의 effect가 옮긴다 —
   * 방장과 팀원이 같은 경로로 움직여야 두 화면이 갈라지지 않는다.
   *
   * **중간에 끊긴 배정을 이어서 되살릴 수 있다.** 이 함수는 세 요청을 순서대로 보내는데,
   * 그중 하나가 실패하면 방이 2단계에 남는다 — 역할이 하나도 없거나 일부만 배정된 상태다.
   * 예전에는 그 방에 다시 들어와도 "다음"이 영구히 잠겨(초대 화면의 CTA가 2단계면 무조건 잠겼다)
   * **앞으로 갈 수단이 아예 없었다**(실기기에서 확인 — 이어하기가 2단계에서 멈췄다).
   *
   * 그래서 재시도를 **덮어쓰지 않게** 만든다. 이미 역할을 받은 사람과 이미 쓰인 카드는 손대지 않고
   * 남은 사람에게 남은 카드만 나눠 준다. 재시도가 새로 섞어 버리면 같은 사람이 다른 카드로 옮겨
   * 앞서 저장된 카드에 유령 배정이 남는다(`PUT`은 카드 단위라 옛 행이 지워지지 않는다).
   */
  const assignRolesAndAdvance = useCallback(async (): Promise<CoopActionResult> => {
    if (missionProgressId === null) return { ok: false, failure: 'retryable' };

    /**
     * 이미 저장된 배정. **가짜는 뺀다** — 심사위원용 모드의 가짜 진행도는 남는 카드를 골라
     * 붙는 것이라(coopDevSimulation.ts) 그것을 "쓰인 카드"로 세면 진짜 참여자에게 줄 카드가
     * 실제보다 적어진다. `realParticipants`는 `participantId`만 보므로 진행도에도 그대로 쓴다.
     */
    const savedProgresses = realParticipants(roleProgresses);

    // **수락이 끝난 사람에게만 나눈다.** 화면의 규칙이 이미 그렇지만(party.ts의 `coopStartBlock` —
    // 대기자가 하나라도 있으면 "다음"도 "다시 역할 나누기"도 잠긴다) 그 규칙과 이 요청이 서로
    // 다른 목록을 보면 안 된다. 대기자에게 역할이 나가면 방장이 그 사람을 거절한 순간
    // 그 카드만 주인 없이 남는다.
    //
    // 가짜 팀원도 뺀다. 섞기에 함께 넣으면 그들이 역할 카드를 차지해 진짜 참여자가 카드를
    // 못 받을 수 있다(시뮬레이션이 자기 몫을 따로 그린다).
    // 그다음 **이미 역할을 받은 사람과 이미 쓰인 카드를 뺀다** — 재시도가 그 배정을 옮기면
    // 한 사람이 두 역할을 갖는다(coopRole.ts의 remainingRoleAssignTargets).
    const targets = remainingRoleAssignTargets(realParticipants(activeParticipants(participants)), roleCards, savedProgresses);
    const assignments = randomRoleAssignments(targets.participants, targets.roleCards);

    // 배정할 것이 없으면 단계를 올리지 않는다 — 역할 없는 재료 찾기 화면은 아무것도 할 수 없다.
    // 역할 카드는 방 생성 응답에만 담겨 오므로(1단계 폴링은 null), 그 응답을 놓치면 여기가 빈다.
    //
    // **이미 배정이 저장돼 있으면 예외다.** 그때 남은 일은 3단계로 올리는 것뿐이라 계속 진행한다 —
    // `PUT`까지 끝내고 마지막 `PATCH(3)`에서 끊긴 방이 정확히 이 경우다.
    if (assignments.length === 0 && savedProgresses.length === 0) {
      coopTrace('assign:빈 배정', { participants: participants.length, real: targets.participants.length, roleCards: targets.roleCards.length });
      return { ok: false, failure: 'retryable' };
    }

    coopTrace('assign:시작', { missionProgressId, assignments: assignments.length, saved: savedProgresses.length, currentStep });

    try {
      // 1) 역할 배정 단계로 먼저 올린다.
      //    **배정보다 단계 이동이 앞선다** — 서버 단계 정의가 2 = 역할 배정이라,
      //    1단계인 채로 배정을 보내면 "지금 단계에서는 할 수 없다"(409)로 거절된다.
      //
      //    **이미 2단계면 보내지 않는다.** 끊긴 배정을 이어서 하는 경우인데, 서버가 같은 단계로의
      //    전이를 거절하면(순차 전이 검사) 그 한 번 때문에 복구 자체가 막힌다.
      if (!isCoopAssigningRoles(currentStep)) {
        await saveProgressMutation.mutateAsync({ missionProgressId, data: { currentStep: COOP_STEP.ROLE_ASSIGNMENT } });
      }

      // 2) 배정을 순차로 저장한다. 한꺼번에 던지면 하나가 실패했을 때 어디까지 저장됐는지 알 수 없고,
      //    서버도 진행도 row를 잠그고 처리하므로 동시 요청이 이득이 아니다.
      for (const assignment of assignments) {
        await saveRoleAssignmentMutation.mutateAsync({
          missionProgressId,
          roleCardId: assignment.roleCardId,
          data: { participantId: assignment.participantId },
        });
      }

      // 3) 미션 수행 단계로 올린다. 사진 인증은 3단계에서만 받는다.
      await saveProgressMutation.mutateAsync({ missionProgressId, data: { currentStep: COOP_STEP.MISSION } });

      // 이동은 폴링이 아니라 이 재조회가 끌어온다. 여기서 기다려야 다음 화면이 배정된 역할을 갖고 시작한다.
      await refreshStatus();
      coopTrace('assign:완료(3단계 저장·재조회까지)');
      return { ok: true };
    } catch (error) {
      coopTrace('assign:실패', { detail: describeApiError(error) });
      return { ok: false, failure: resolveCoopFailure(error), detail: describeApiError(error) };
    }
  }, [missionProgressId, participants, roleCards, roleProgresses, currentStep, saveRoleAssignmentMutation, saveProgressMutation, refreshStatus]);

  /** 재료 찾기 "다음" — 완료 단계로 올린다 */
  const advanceToComplete = useCallback(async (): Promise<CoopActionResult> => {
    if (missionProgressId === null) return { ok: false, failure: 'retryable' };

    try {
      await saveProgressMutation.mutateAsync({ missionProgressId, data: { currentStep: COOP_STEP.COMPLETE } });
      await refreshStatus();
      return { ok: true };
    } catch (error) {
      return { ok: false, failure: resolveCoopFailure(error), detail: describeApiError(error) };
    }
  }, [missionProgressId, saveProgressMutation, refreshStatus]);

  /**
   * 내 역할 사진 인증. itemImage는 RN 파일 파트(`toReactNativeFilePart`)를 그대로 넘긴다.
   *
   * **인증 실패는 에러가 아니다.** 사진이 역할과 맞지 않으면 서버가 `200 { isVerified: false }`를
   * 준다(사진을 올리지도, 역할 진행도를 바꾸지도 않는다). 그래서 성공/실패를 status code가 아니라
   * 응답 본문으로 가른다 — `ok: true`인데 `verified: false`인 경우가 정상 흐름에 있다.
   *
   * 갱신된 `itemImgUrl`과 역할 상태는 이 응답이 주지 않는다. 상태 조회로 확인한다(계약 명시).
   */
  const verifyMyRole = useCallback(
    async (roleProgressId: number, itemImage: Blob): Promise<CoopVerifyResult> => {
      if (missionProgressId === null) return { ok: false, failure: 'retryable' };

      try {
        const { isVerified } = await verifyRoleMutation.mutateAsync({ missionProgressId, roleProgressId, data: { itemImage } });
        // 실패해도 상태를 다시 읽는다 — 그 사이 팀원이 인증을 마쳤을 수 있다.
        await refreshStatus();
        return { ok: true, verified: isVerified };
      } catch (error) {
        return { ok: false, failure: resolveCoopFailure(error), detail: describeApiError(error) };
      }
    },
    [missionProgressId, verifyRoleMutation, refreshStatus],
  );

  /** 방 나가기. 보상을 받지 못한 채 방에서 빠진다 */
  const leaveRoom = useCallback(async () => {
    if (missionProgressId === null) return;
    await leaveMutation.mutateAsync({ missionProgressId });
  }, [missionProgressId, leaveMutation]);

  return {
    status,
    participants,
    roleCards,
    roleProgresses,
    currentStep,
    myParticipantId,
    previousParticipants,
    isLoading: statusQuery.isPending,
    isError: statusQuery.isError,
    /**
     * 폴링이 실패한 이유. 성공 중이면 null이다.
     *
     * `gone`(방이 사라짐 · 내가 참여자가 아님)과 `already-completed`는 화면이 떠나야 하는 실패다 —
     * 방장이 마지막으로 나가면 서버가 진행도를 통째로 소프트 딜리트하므로 남아 있으면 빈 화면이 된다.
     */
    statusFailure: statusQuery.isError ? resolveCoopFailure(statusQuery.error) : null,
    rememberParticipants,
    refreshStatus,
    acceptParticipant,
    rejectParticipant,
    assignRolesAndAdvance,
    advanceToComplete,
    verifyMyRole,
    leaveRoom,
    isAdvancing: saveProgressMutation.isPending || saveRoleAssignmentMutation.isPending,
    isVerifying: verifyRoleMutation.isPending,
  };
}

/**
 * 방 만들기·이어하기.
 *
 * 서버는 신규 201 / 이어하기 200으로 구분하지만 클라이언트는 같게 다룬다 — 응답 구조가 같다.
 * 어디로 갈지는 호출부(`useEnterCoopRoom`)가 정하는데, `currentStep`만으로는 부족하다:
 * **이미 끝난 진행도를 그대로 돌려주는 경우**가 있어 `missionProgressStatus`를 먼저 본다
 * (coopStep.ts의 `coopEntryOutcome`).
 *
 * 이름이 "방장"을 뜻하지 않는다는 점에 주의한다. 이 요청이 어떤 진행도를 돌려주는지는 서버가
 * 정하고, 응답은 내가 그 방에서 HOST인지 MEMBER인지 알려 주지 않는다(`currentParticipant`가 없다).
 */
export function useStartCoopMission() {
  const enterRoom = useCoopPartyStore((state) => state.enterRoom);
  const mutation = useStartCoopMissionMutation();

  const start = useCallback(
    async (cooperativeMissionId: number) => {
      const started = await mutation.mutateAsync({ cooperativeMissionId });
      coopTrace('시작:응답', {
        missionProgressId: started.missionProgressId,
        currentStep: started.currentStep,
        participants: started.participants.length,
        host: findHost(started.participants)?.participantId ?? null,
        roleCards: started.roleCards.length,
      });
      enterRoom({
        missionProgressId: started.missionProgressId,
        teamToken: started.teamToken,
        /**
         * 첫 폴링 전까지 "나"를 그릴 값. **근거가 있을 때만 채운다.**
         *
         * 이 응답(`CooperativeMissionStartResponse`)에는 `currentParticipant`가 없다 —
         * 서버가 토큰으로 나를 식별해 주는 곳은 상태 조회뿐이다. 그래서 참여자가 한 명뿐인
         * 응답(새로 시작한 방)에서만 그 한 명이 나라고 말할 수 있다(party.ts의 soleParticipantId).
         *
         * 예전에는 `findHost(started.participants)`로 **방장을 곧 나라고 단정**했다. 근거로 삼은
         * 것은 "이어하기는 내가 HOST로 참여 중인 진행도만 돌려준다"는 계약 해석이었는데,
         * 지금 계약 문서(같은 응답의 설명)에는 그런 제한이 없다 — "기존 진행도를 이어서 하면 200"
         * 뿐이다. 근거 없는 단정이라 두 가지가 함께 틀어졌다:
         *   - 멤버가 이어하기로 들어오면 자기를 방장으로 오인한다(초대 칩·수락/거절·"다음"이
         *     열리고 "나의 역할"에 방장의 역할이 그려진다).
         *   - `myParticipantId`가 곧 방장이 되므로 승계 판정이 동어반복이 된다.
         *
         * 알 수 없으면 null이고, 첫 폴링의 `currentParticipant`가 곧 확정한다(아래 effect).
         * 상태 코드로 201/200을 가르지 못하는 사정은 그대로다 — orval mutator가 `response.data`만
         * 돌려주어 상태 코드가 남지 않는다. 가를 필요도 없다: 판정 근거가 참여자 수 하나다.
         *
         * **`realParticipants`를 반드시 통과시킨다.** 지금 이 응답은 서버 원본이라 가짜가 없지만,
         * 신원 판정의 근거로 시뮬레이션이 섞인 목록이 들어오는 순간 이 규칙은 조용히 무너진다 —
         * 심사위원용 모드는 가짜 팀원 3명을 붙이므로(coopDevSimulation.ts) 혼자 만든 방도
         * 4명이 되어 "한 명뿐일 때만"이 언제나 거짓이 된다. 근거를 여기서 못 박아 둔다.
         */
        myParticipantId: soleParticipantId(realParticipants(started.participants)),
        roleCards: started.roleCards,
        // 첫 폴링 전까지 초대 화면이 그릴 목록. 방장 본인이 여기 들어 있다.
        participants: started.participants,
      });
      return started;
    },
    [mutation, enterRoom],
  );

  return { start, isStarting: mutation.isPending, isError: mutation.isError };
}

/** 참여 요청 결과. 실패도 예외가 아니라 값으로 돌려준다 — 호출부가 문구를 정해야 한다 */
export type JoinCoopMissionResult = { ok: true; participantStatus: JoinCoopMissionResponse['participantStatus'] } | { ok: false; failure: CoopFailure; detail?: string };

/**
 * 초대 링크로 들어온 팀원의 참여 요청.
 *
 * **호출부는 `app/mission/invite.tsx` 하나다**(초대 딥링크 착지 화면). 한동안 이 훅은 어디서도
 * 불리지 않는 죽은 코드였다 — 링크를 만드는 쪽(`config/inviteUrl.ts`)만 있고 그 링크를 받아
 * 여기로 넘기는 라우트가 없었기 때문이다. 라우트를 만들면서 다시 이어 붙였으니, 그 화면을
 * 지우면 이 훅도 함께 죽는다.
 *
 * 응답의 `participantStatus`가 `PENDING`이면 방장의 수락을 기다리는 화면에 머물고,
 * `ACCEPTED`면 바로 방으로 들어간다. 어느 쪽이든 `missionProgressId`로 폴링을 시작한다.
 *
 * 실패를 던지지 않고 `failure`로 돌려주는 이유: 참여 요청은 **정상 흐름에서도 실패한다**
 * (정원이 찼거나, 방이 이미 다음 단계로 넘어갔거나, 링크가 만료됐거나). 예외로 다루면
 * 호출부마다 try/catch가 붙고 한 곳이라도 빠지면 앱이 깨진다.
 */
export function useJoinCoopMission() {
  const enterRoom = useCoopPartyStore((state) => state.enterRoom);
  const mutation = useJoinCoopMissionMutation();

  const join = useCallback(
    async (teamToken: string): Promise<JoinCoopMissionResult> => {
      try {
        const joined = await mutation.mutateAsync({ data: { teamToken } });
        enterRoom({
          missionProgressId: joined.missionProgressId,
          teamToken,
          myParticipantId: joined.participantId,
        });
        return { ok: true, participantStatus: joined.participantStatus };
      } catch (error) {
        // 정원 초과(`full`)는 미션 홈에서 토스트로 알린다(사용자 지시).
        return { ok: false, failure: resolveCoopFailure(error), detail: describeApiError(error) };
      }
    },
    [mutation, enterRoom],
  );

  return { join, isJoining: mutation.isPending };
}
