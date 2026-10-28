import { MAX_PARTY_SIZE } from '@packages/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { CoopStepLayout } from '@/components/Coop/CoopStepLayout/CoopStepLayout';
import { InviteShareSheet } from '@/components/Coop/InviteShareSheet/InviteShareSheet';
import { PartyMemberCard } from '@/components/Coop/PartyMemberCard/PartyMemberCard';
import type { StatusTone } from '@/components/Coop/StatusBadge/StatusBadge';
import { FullBleed } from '@/components/FullBleed/FullBleed';
import { MissionCancelModal } from '@/components/Mission/MissionCancelModal/MissionCancelModal';
import { useToast } from '@/components/Toast/Toast';
import { buildInviteUrl } from '@/config/inviteUrl';
import { COOP_HOST_CHANGED_MESSAGE, COOP_STEP_COPY, coopRejectedMessage } from '@/constants/coopMission';
import { resolveMissionId } from '@/constants/missionHome';
import { useCoopMissionRoom } from '@/hooks/useCoopMission';
import { useCoopPartyChanges } from '@/hooks/useCoopPartyChanges';
import { useEnterCoopRoom } from '@/hooks/useEnterCoopRoom';
import { useMissionCancelGuard } from '@/hooks/useMissionCancelGuard';
import { useMissionLocationPermission } from '@/hooks/useMissionLocationPermission';
import { useSinglePress } from '@/hooks/useSinglePress';
import { COOP_ROOM_UNDECIDED, coopRoomToOpen, useCoopPartyStore } from '@/store/coopParty';
import { coopInviteStyles as styles } from '@/styles/coopInvite';
import { COOP_BACKGROUND_COLORS, COOP_CIRCLE_COLORS, coopStepStyles } from '@/styles/coopStep';
import { COOP_FAILURE_MESSAGE, coopFailureMessage } from '@/utils/coopFailure';
import {
  coopAssignPhase,
  coopHrefForScreen,
  coopIntroRoute,
  coopInviteActionsOpen,
  coopInviteNoticeKind,
  coopRouteForScreen,
  coopScreenAdvance,
  shouldShowRoleAssignNotice,
  type CoopInviteNoticeKind,
} from '@/utils/coopStep';
import { coopTrace } from '@/utils/coopTrace';
import { navigate } from '@/utils/navigate';
import { activeParticipants, canInviteMore, canReviewJoinRequest, coopStartBlock, findHost, isHost, isParticipantReady } from '@/utils/party';

/** 거절당한 당사자에게 보이는 문구 */
const REJECTED_MESSAGE = '초대 수락이 거절되었어요';

/**
 * 참여 멤버 헤더 아래 한 줄. **역할을 배정하는 중(서버 2단계)에는 다른 말을 한다.**
 *
 * 그 구간에도 화면은 여기 그대로다(coopStep.ts) — 배정이 끝나 3단계가 되어야 재료 찾기로 간다.
 * 그동안 "모두 준비 완료되어야 시작할 수 있어요"가 그대로 있으면, 전원이 준비된 채로 버튼만
 * 잠긴 화면이 되어 무엇을 기다리는지 알 수 없다. CTA 라벨과 같은 사실을 말한다.
 */
const READY_NOTICE = '모두 준비 완료되어야 시작할 수 있어요.';
const ASSIGNING_NOTICE = '역할을 배정하고 있어요. 잠시만 기다려주세요.';
const ASSIGNING_CTA_TEXT = '역할 배정 중...';

/**
 * **배정이 끊긴 방**에 다시 들어온 방장에게 보이는 문구와 CTA.
 *
 * 서버 단계는 2인데 이 기기는 아무것도 하고 있지 않은 상태다(coopStep.ts의 `coopAssignPhase`).
 * 예전에는 이 구간에도 "역할을 배정하고 있어요"가 그대로 남고 CTA가 잠겨 있어, **아무도 배정을
 * 이어받고 있지 않은데 영원히 기다리는 화면**이 됐다 — 실기기에서 이어하기가 2단계에서 멈췄다.
 *
 * 팀원에게는 이 문구를 보이지 않는다. 그들은 어차피 이 버튼을 누를 수 없고(방장만 누른다),
 * "중단됐다"고만 말하면 할 수 있는 것이 없는 채로 불안하기만 하다.
 */
const ASSIGN_STALLED_NOTICE = '역할 배정이 중단됐어요. 다시 시도해주세요.';
const ASSIGN_RETRY_CTA_TEXT = '다시 역할 나누기';

/**
 * 재시도가 **대기자 때문에** 막혀 있을 때 방장에게 보이는 문구.
 *
 * 사용자가 확정한 규칙이 "전원 준비 완료가 아니면 재시도되지 않는다"이므로(party.ts의
 * `coopStartBlock`), 배정이 끊긴 뒤에 초대 링크로 들어온 사람이 하나만 있어도 CTA가 잠긴다.
 * **버튼만 잠그고 이유를 알리지 않으면 그것도 막다른 길이다** — 방장 눈에는 "다시 역할 나누기"가
 * 눌리지 않는 화면일 뿐이다.
 *
 * 그래서 할 일을 그대로 말한다. 그 조작은 바로 아래 목록의 대기자 카드에 붙어 있으므로
 * (`canReviewJoinRequest`가 끊긴 2단계에서는 수락·거절을 그대로 연다) 문구를 읽고 곧장 할 수 있다.
 */
const PENDING_REVIEW_NOTICE = '대기 중인 참여자를 먼저 수락하거나 거절해주세요.';

/**
 * 헤더 아래 한 줄의 문구표. **어느 문구를 고를지는 `coopInviteNoticeKind`가 정한다**(coopStep.ts).
 *
 * 판정과 문장을 갈라 두는 이유는 이 화면의 다른 판정들과 같다 — 어떤 상태에서 무엇을 말하는지는
 * 화면을 띄우지 않고 확인할 수 있어야 하고, 실제로 여기서 "버튼은 잠겼는데 이유는 안 알리는"
 * 회귀가 났다.
 */
const INVITE_NOTICE_TEXT: Record<CoopInviteNoticeKind, string> = {
  ready: READY_NOTICE,
  assigning: ASSIGNING_NOTICE,
  stalled: ASSIGN_STALLED_NOTICE,
  'pending-review': PENDING_REVIEW_NOTICE,
};

/**
 * 배정이 시작됐다는 **토스트**(사용자 지시: "랜덤으로 역할을 정하고 있습니다"를 어투에 맞춰 다듬음).
 *
 * 위 두 문구와 역할이 다르다. 토스트는 **사건**을 알린다 — "지금 막 시작됐다". 1.4초 뒤 사라진다.
 * 헤더 아래 한 줄은 **상태**를 설명한다 — 기다리는 동안 계속 남아 버튼이 왜 잠겼는지 말한다.
 * 배정이 실패하면 그 갈래가 `coopFailureMessage`를 이어서 띄우므로(startMaterials) 이 문구가
 * 남아 있지 않는다 — 토스트는 겹치지 않고 줄을 서기 때문이다(Toast.tsx).
 */
const ASSIGNING_TOAST = '역할을 랜덤으로 정하고 있어요';

/**
 * 참여자 한 줄의 우측 배지.
 *
 * 방장은 아직 수락하지 않은 사람에게 "거절 / 수락"을 누를 수 있어서 배지 대신 버튼이 들어간다.
 *
 * 준비 완료 배지는 **나만 주황색이고 나머지는 회색**이다(사용자 지시). 목록에서 내 줄을
 * 먼저 찾게 하려는 강조라, 색이 상태가 아니라 "누구인지"를 나타낸다.
 */
function memberStatus(ready: boolean, isMe: boolean): { label: string; tone: StatusTone } {
  if (!ready) return { label: '대기중', tone: 'waiting' };
  return { label: '준비 완료', tone: isMe ? 'done' : 'waiting' };
}

export default function TogetherMissionScreen() {
  const { show } = useToast();
  const cancelGuard = useMissionCancelGuard();

  // 홈·마이페이지의 "이어서 진행"이 이 화면으로 곧장 들어온다(missionNavigateTarget.ts).
  // 그때는 아직 방이 없어서 미션 id로 직접 열어야 한다.
  const { missionId: rawMissionId } = useLocalSearchParams<{ missionId?: string }>();

  const {
    status,
    participants,
    currentStep,
    myParticipantId,
    previousParticipants,
    statusFailure,
    rememberParticipants,
    acceptParticipant,
    rejectParticipant,
    assignRolesAndAdvance,
    leaveRoom,
    isAdvancing,
  } = useCoopMissionRoom();

  const teamToken = useCoopPartyStore((state) => state.teamToken);
  const reset = useCoopPartyStore((state) => state.reset);
  const missionProgressId = useCoopPartyStore((state) => state.missionProgressId);
  const pauseRoom = useCoopPartyStore((state) => state.pauseRoom);
  const forgetPausedRoom = useCoopPartyStore((state) => state.forgetPausedRoom);
  const hostChangedWhilePaused = useCoopPartyStore((state) => state.hostChangedWhilePaused);
  const consumeHostChangeNotice = useCoopPartyStore((state) => state.consumeHostChangeNotice);
  const roleAssignNoticeShown = useCoopPartyStore((state) => state.roleAssignNoticeShown);
  const markRoleAssignNoticeShown = useCoopPartyStore((state) => state.markRoleAssignNoticeShown);

  /**
   * 방이 필요하면 **이 화면이 직접 연다.**
   *
   * `POST /api/v1/cooperative-missions/{cooperativeMissionId}/progress` 하나가 새로 시작과
   * 이어하기를 모두 맡고, 응답의 `currentStep`이 어느 단계인지 정한다. 그래서 이어하기도
   * 인트로를 거칠 필요가 없다(사용자 지시) — 협동 미션의 첫 화면인 여기로 곧장 들어와서,
   * 단계가 더 앞서 있으면 `useEnterCoopRoom`이 그 단계 화면으로 바꿔 끼운다.
   *
   * "방이 없을 때만" 여는 것이 아니다. 홈·마이페이지의 "이어서 진행"으로 들어오면
   * (라우트에 `missionId`가 실려 있으면) 스토어에 방이 남아 있어도 다시 연다 —
   * 남아 있는 방이 **방금 끝낸 다른 방**일 수 있기 때문이다(store/coopParty.ts의 shouldOpenCoopRoom).
   *
   * "시작하기"로 들어온 경우에는 인트로가 이미 방을 열어 뒀고 파라미터도 없어 이 경로가 돌지 않는다.
   */
  const enterCoopRoom = useEnterCoopRoom();
  /**
   * 이 진입에서 열 방의 미션 id. null이면 열지 않는다.
   *
   * **스토어에 방이 남아 있어도 열어야 하는 경우가 있고**(홈의 "이어서 진행"), 그 판단 근거는
   * `coopRoomToOpen`에 있다(store/coopParty.ts).
   *
   * **마운트 시점에 한 번만 계산한다.** 그 판단이 읽는 `missionProgressId`는 화면이 사는 동안
   * 바뀌는 값이라("잠깐 쉴게요"가 `reset()`으로 비운다) 매 렌더 다시 물으면 떠나려는 화면이
   * 방을 새로 여는 되먹임이 생긴다 — 실기기에서 확인된 "쉬기 → 인트로 → 곧바로 다시 미션 화면"이
   * 그 경로다. 시간 순서와 근거는 `coopRoomToOpen` 주석에 적어 두었다.
   *
   * 지연 초기화 useState가 "한 번만"을 표현하는 자리다. 판정 자체는 순수 함수라 화면 없이 검증한다.
   */
  const [missionIdToOpen] = useState<number | null>(() => coopRoomToOpen(COOP_ROOM_UNDECIDED, missionProgressId, rawMissionId, resolveMissionId(rawMissionId, 'coop')));
  // 권한 요청도 같은 판단을 따른다 — 매 렌더 다시 물으면 쉬기 직후에 권한 팝업이 한 번 더 뜬다
  const ensureLocationGranted = useMissionLocationPermission(missionIdToOpen !== null);
  /**
   * 방을 여는 요청이 아직 끝나지 않았다.
   *
   * `missionProgressId`만으로는 이 구간을 알 수 없다 — 스토어에 **끝난 방이 남아 있는** 진입에서는
   * 값이 채워져 있어서, 그것만 보면 응답을 기다리는 동안 옛 방의 초대 화면이 그려진다.
   * 마운트 시점에 한 번 계산해 두어(아래 effect가 돌기 전) 그 한 프레임도 생기지 않게 한다.
   */
  const [openingRoom, setOpeningRoom] = useState(missionIdToOpen !== null);

  /**
   * 인트로로 되돌아갈 때 실어 보낼 협동 미션 id(`coopIntroRoute`).
   *
   * 상태 조회 응답이 가장 정확한 출처다 — 방 생성·이어하기 응답에는 `missionId`가 없고
   * (`CooperativeMissionStartResponse`), 인트로에서 "시작하기"로 들어온 경로는 라우트
   * 파라미터도 비어 있다. 홈의 "이어서 진행"으로 들어온 경우에만 파라미터가 있어 첫 폴링 전에도
   * id를 안다. 둘 다 없으면 null이고, 그때는 인트로가 폴백 id를 쓴다.
   */
  const missionIdForIntro = status?.missionId ?? (rawMissionId === undefined ? null : resolveMissionId(rawMissionId, 'coop'));
  // 한 번만 보낸다. 이어하기는 멱등하지만(200) 두 번 보내면 화면 전환도 두 번 일어난다
  const hasRequestedRoomRef = useRef(false);

  useEffect(() => {
    if (missionIdToOpen === null || hasRequestedRoomRef.current) return;
    hasRequestedRoomRef.current = true;

    void (async () => {
      try {
        // **먼저 남아 있는 방을 버린다.** 이 진입에서 볼 방은 아래 이어하기 응답이 정하는데,
        // 그때까지 스토어에 옛 방이 남아 있으면 폴링이 그 방을 계속 읽는다 — 끝난 방이면
        // 아래 단계 이동 effect가 응답보다 먼저 완료 화면으로 옮겨 버리고(4단계), 사라진 방이면
        // `statusFailure`가 인트로로 보내 버린다. 어느 쪽이든 사용자가 누른 미션이 아니다.
        reset();
        // 방 상태 조회가 좌표를 필수로 받는다 — 권한 없이 들어가면 폴링이 통째로 막힌다
        if (!(await ensureLocationGranted())) {
          navigate.replace('/home');
          return;
        }
        // 실패하면 useEnterCoopRoom이 안내를 띄운다. 방이 없는 화면에 남겨 두지 않고 홈으로 보낸다.
        // 여기도 사람이 만든 전환이 아니라 게이트를 지나지 않는다 — 들어올 때 쓴 전환 직후라
        // 게이트에 걸리면 방도 없는 빈 초대 화면에 갇힌다.
        //
        // `'already-completed'`(끝난 진행도를 돌려받음)는 그 훅이 토스트와 인트로 이동까지
        // 끝낸다 — 여기서 홈으로 덮어쓰면 안내를 띄운 화면이 곧바로 사라진다.
        if ((await enterCoopRoom(missionIdToOpen, 'replace')) === 'failed') navigate.replaceProgrammatic('/home');
      } finally {
        // 어느 갈래로 끝나든 대기 화면은 걷는다. 성공 갈래에서는 이미 방이 채워져 있고,
        // 실패 갈래에서는 화면 자체가 여기를 떠난다.
        setOpeningRoom(false);
      }
    })();
    // 두 함수는 렌더마다 새로 만들어지지만 위 ref가 실행을 한 번으로 묶는다 —
    // 의존성에 넣으면 "바뀌었으니 다시" 판단만 흔들린다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionIdToOpen]);

  const [shareError, setShareError] = useState<string | null>(null);
  /** 초대 공유 시트에 넘길 URL. null이면 시트가 닫혀 있다는 뜻이다 */
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const members = activeParticipants(participants);
  const iAmHost = isHost(participants, myParticipantId);

  /**
   * 배정 요청이 **이 기기에서** 나가 있는지.
   *
   * ref는 렌더를 기다리지 않는 잠금(연타 차단)이고, state는 그 사실을 화면에 알린다.
   * 둘 다 필요하다 — ref만 두면 CTA 라벨이 바뀌지 않고, state만 두면 같은 틱의 두 번째 탭이
   * 다음 렌더를 기다리는 사이에 통과한다.
   *
   * **서버 단계로 이 잠금을 대신할 수 없다.** 예전에는 단계 2를 그대로 잠금에 썼는데, 그러면
   * 배정이 끊겨 2단계에 굳은 방에 다시 들어온 방장까지 영구히 잠긴다 — "지금 돌고 있다"와
   * "멈춰 있다"는 서버 단계가 같아도 정반대 상황이다(coopStep.ts의 `coopAssignPhase`).
   * 요청을 두 번 보내지 않는 것은 이 두 잠금이 이미 보장한다.
   */
  const assignInFlightRef = useRef(false);
  const [assignInFlight, setAssignInFlight] = useState(false);
  const startInFlight = assignInFlight || isAdvancing;

  /**
   * **이 화면의 상태는 이 값 하나로 정해진다** — 배정 중인지, 끊긴 채 멈췄는지, 아직 단계를
   * 모르는지, 평소의 초대 단계인지(coopStep.ts의 `coopAssignPhase`).
   *
   * 아래 조작·문구·목록이 전부 여기서 갈라진다. 예전에는 각자 다른 근거를 봤고(어떤 것은 서버
   * 단계, 어떤 것은 `canStartCoopMission`의 완화), 그래서 전이 중에 **서로 다른 단계를 말하는
   * 화면**이 나왔다 — 사용자가 본 "재시도를 눌렀더니 수락/거절 1단계가 되는" 증상이 그것이다.
   *
   * 끊긴 방을 되살릴 수 있는 사람은 방장뿐이라(canStartCoopMission) 재시도 CTA와 안내도
   * 방장에게만 보인다. 팀원 화면에서는 그냥 "배정하고 있어요"가 남는다 — 그들이 할 수 있는
   * 일이 없다.
   */
  const assignPhase = coopAssignPhase(currentStep, startInFlight);
  const canRetryAssign = assignPhase === 'stalled' && iAmHost;
  /**
   * 수락·거절과 "다음"이 **같이** 열리고 같이 닫힌다(coopStep.ts의 `coopInviteActionsOpen`).
   * 한쪽만 열린 화면을 만들지 않는 것이 이번 수정의 요점이다.
   */
  const actionsOpen = coopInviteActionsOpen(assignPhase, currentStep);

  /**
   * "다음"을 막고 있는 것. `'none'`이면 규칙상 누를 수 있다(party.ts의 `coopStartBlock`).
   *
   * **끊긴 2단계의 재시도도 같은 규칙을 지난다**(사용자 확정): 그 사이에 누가 초대로 들어왔더라도
   * 전원이 준비 완료가 아니면 재시도되지 않는다. "준비 완료여야 2단계로 갈 수 있다"가 규칙이라면
   * 2단계에서 다시 나누는 것도 그 규칙을 만족해야 한다 — 재시도는 예외가 아니라 같은 일을 다시
   * 하는 것이다. 막힌 방장에게는 아래 `PENDING_REVIEW_NOTICE`가 무엇을 해야 하는지 알려 주고,
   * 그 대기자의 수락·거절 버튼이 `actionsOpen` 덕분에 바로 그 자리에 있다.
   */
  const startBlock = coopStartBlock(participants, myParticipantId);
  const canStart = actionsOpen && startBlock === 'none';

  /**
   * 목록에 그리는 사람들. **배정이 도는 동안에만 수락이 끝난 사람만 남긴다**(사용자 지시).
   *
   * 평소에는 대기자도 함께 그린다 — 그 카드가 방장이 수락·거절을 누르는 자리이기 때문이다.
   * 그런데 배정이 도는 동안에는 그 조작이 없어지므로, 대기자를 그대로 두면 **아무도 손댈 수 없는
   * "대기중" 줄**이 남는다. 그 줄은 헤더의 "참여 멤버 (n/6)"에 세지도 않아(그 수는 수락된 사람만
   * 센다) 수와 줄 수가 어긋나기까지 한다.
   *
   * **끊긴 2단계에서는 숨기지 않는다.** 거기서는 그 대기자가 재시도를 막고 있는 당사자라,
   * 숨기면 방장은 무엇 때문에 막혔는지 볼 수조차 없다.
   */
  const visibleParticipants = assignPhase === 'assigning' ? members : participants;

  /**
   * "역할을 랜덤으로 정하고 있어요" 토스트. **한 진입에 한 번만 뜬다.**
   *
   * 폴링은 2초마다 같은 2단계를 돌려주므로 조건만 보고 띄우면 도배된다. 그래서 "이미 띄웠다"를
   * 함께 보는데, 그 사실을 **화면 안의 ref가 아니라 스토어에** 둔다(`roleAssignNoticeShown`).
   * 승계 안내(`consumeHostChangeNotice`)와 같은 자리다.
   *
   * ref였을 때 실기기에서 **같은 토스트가 두 번 떴다.** 홈의 "이어서 진행"은 이 화면을 한 진입에
   * 두 번 마운트하기 때문이다 — 파라미터를 달고 한 번, 이어하기 응답이 2단계를 주면
   * `useEnterCoopRoom`이 파라미터 없는 같은 경로로 갈아 끼워 또 한 번. 마운트마다 새로 생기는
   * ref로는 그 두 번을 하나로 묶을 수 없다(store/coopParty.ts에 그 경로를 적어 두었다).
   *
   * 스토어를 `getState()`로 읽는다. 구독값(`roleAssignNoticeShown`)은 다음 렌더에나 참이 되는데,
   * 방장이 누른 즉시 부르는 경로와 폴링 effect 경로가 **같은 틱에 겹칠 수 있어서** 그 사이를
   * 렌더로 메우면 두 번 뜬다. 스토어 값은 `set`이 동기라 곧바로 참이 된다.
   *
   * **방장뿐 아니라 팀원에게도 띄운다.** 2단계에서는 모두가 이 화면에 붙잡히는데(coopStep.ts),
   * 누른 적 없는 팀원 입장에서는 화면이 아무 이유 없이 멈춘 것으로 보인다. 배정을 시작한 사실
   * 자체는 방 전체의 사건이므로 방 안의 모두가 안다.
   */
  const showAssigningNotice = useCallback(() => {
    if (useCoopPartyStore.getState().roleAssignNoticeShown) return;
    markRoleAssignNoticeShown();
    show(ASSIGNING_TOAST);
  }, [show, markRoleAssignNoticeShown]);

  /**
   * 팀원(과 2단계 방으로 다시 들어온 사람)이 이 토스트를 받는 경로.
   *
   * 누른 방장은 이 effect를 기다리지 않는다 — `startMaterials`가 누른 즉시 같은 함수를 부른다.
   * 단계가 2로 바뀐 것을 폴링으로 아는 데는 최대 2초가 걸리는데, 자기가 누른 버튼의 반응이
   * 그만큼 늦으면 눌리지 않은 것처럼 보인다. 두 경로가 같은 스토어 플래그를 지나므로 겹치지 않는다.
   */
  useEffect(() => {
    // 끊긴 방에 들어온 방장에게는 띄우지 않는다 — 헤더 아래에 "역할 배정이 중단됐어요"가 떠 있는데
    // 그 위로 "정하고 있어요"가 겹치면 두 문장이 서로 다른 말을 한다.
    if (canRetryAssign) return;
    if (!shouldShowRoleAssignNotice(currentStep, roleAssignNoticeShown)) return;
    showAssigningNotice();
  }, [canRetryAssign, currentStep, roleAssignNoticeShown, showAssigningNotice]);

  // 방장이 단계를 올리면 팀원도 폴링으로 그 변화를 받아 같은 화면으로 따라온다.
  // 방장 자신도 이 경로로 이동한다 — 두 사람이 같은 코드로 움직여야 화면이 갈라지지 않는다.
  useEffect(() => {
    // 어디로 갈지(또는 제자리에 머물지)는 `coopScreenAdvance`가 정한다. 단계를 모르는 동안
    // 움직이지 않는 것과 뒤로 가지 않는 것이 모두 그 안에 있다 — 두 화면이 같은 규칙을 써야
    // 서로를 밀어내는 왕복이 생기지 않는다(coopStep.ts).
    //
    // **2단계(역할 배정 중)에는 여기 그대로 머문다.** 배정이 끝나 3단계가 되어야 재료 찾기로
    // 간다 — 2단계에서 넘어가면 그 시점 응답의 `roleProgresses`가 아직 비어 있어
    // "나의 역할"이 빈 화면에 도착한다(사용자 지시로 확정한 순서).
    const screen = coopScreenAdvance('invite', currentStep);
    coopTrace('초대:단계 확인', { currentStep, screen });
    if (screen === null) return;
    // 서버가 이미 다음 단계로 넘어갔으므로 초대 화면으로 되돌아갈 자리가 없다.
    //
    // **연타 게이트를 지나지 않는 전환이어야 한다(navigate.ts).** 이 화면에 막 들어온 직후
    // 첫 폴링이 도착하는 경우가 흔한데(홈의 "이어서 진행"), 그때는 들어올 때 쓴 전환과의 간격이
    // 400ms보다 짧아 게이트가 이걸 버린다. 이 effect의 의존성은 `currentStep` 하나라
    // 한 번 버려지면 다시 시도하지 않는다 — 3단계 방인데 초대 화면에 영구히 남는다.
    //
    // 완료 화면에 필요한 `mission: 'coop'`은 `coopHrefForScreen`이 붙인다. 예전에는 여기서 직접
    // 조립했는데, 같은 판단을 하는 `useEnterCoopRoom`이 그걸 빠뜨려 협동 완료가 문화 미션 완료
    // 화면으로 떨어졌다 — 파라미터까지 한 곳에서 정한다(coopStep.ts).
    coopTrace('초대:이동', { to: coopRouteForScreen(screen) });
    navigate.replaceProgrammatic(coopHrefForScreen(screen));
  }, [currentStep]);

  // 폴링 응답 사이의 변화를 알린다. 폴링은 같은 값을 반복해서 주므로 이전 스냅샷과 비교해
  // 한 번만 띄운다. 방장 승계·거절 모두 서버가 정하고 클라이언트는 변화만 읽는다.
  //
  // 판정은 `useCoopPartyChanges`에 있다 — 재료 찾기 화면도 같은 규칙을 써야 해서 옮겼다.
  // 이 화면에 남는 것은 "이 단계에서 그 변화가 무슨 뜻인가"뿐이다.
  useCoopPartyChanges({
    participants,
    previousParticipants,
    myParticipantId,
    rememberParticipants,
    // 초대 단계에서 내가 목록에서 사라졌다면 방장이 나를 거절한 것이다
    onRemoved: useCallback(() => {
      show(REJECTED_MESSAGE);
      reset();
      navigate.replace(coopIntroRoute(missionIdForIntro));
    }, [show, reset, missionIdForIntro]),
    onBecameHost: useCallback(() => show(COOP_HOST_CHANGED_MESSAGE), [show]),
    // 방장에게는 자기가 누른 거절의 결과이고, 남은 팀원에게는 폴링으로 알게 되는 변화다.
    onDeparted: useCallback((removed) => show(coopRejectedMessage(removed.name)), [show]),
  });

  /**
   * 쉬는 동안 방장이 바뀌었다는 안내.
   *
   * 이어하기 응답이 도착한 순간(`enterRoom`) 스토어에 켜지고, 그 응답의 `currentStep`이 정한
   * 화면이 여기서 한 번 띄운다. 플래그를 곧바로 내리므로 재렌더나 폴링으로 다시 뜨지 않는다.
   *
   * 이 화면이 직접 방을 여는 경로(홈의 "이어서 진행")에서는 마운트 뒤에 플래그가 켜지는데,
   * 스토어를 구독하고 있어 그때 effect가 다시 돌아 안내가 뜬다.
   */
  useEffect(() => {
    if (!hostChangedWhilePaused) return;
    show(COOP_HOST_CHANGED_MESSAGE);
    consumeHostChangeNotice();
  }, [hostChangedWhilePaused, show, consumeHostChangeNotice]);

  /**
   * "일행 초대" — OS 공유 시트를 곧바로 띄우지 않고 확인 시트를 먼저 연다.
   *
   * URL 조립을 렌더가 아니라 여기서 하는 이유: `buildInviteUrl`은 토큰이 비었거나 도메인 설정이
   * 없으면 **throw한다.** 렌더 중에 부르면 그 순간 화면이 통째로 깨지므로, 눌렀을 때만 만들고
   * 실패는 안내 문구로 바꾼다.
   */
  const handleInvite = useCallback(() => {
    if (teamToken === null) return;
    try {
      // 서버는 팀 토큰만 주고 URL은 프론트가 조립한다(계약 변경). 도메인은 WebView가 쓰는 값과
      // 같은 곳에서 읽어 두 경로가 갈라지지 않게 한다.
      //
      // 이 https 링크를 누르면 web의 `/cooperative-missions/invite`가 열리고, 그 페이지가
      // `tamnalog:///mission/invite?token=…`으로 넘겨 앱의 `app/mission/invite.tsx`가 참여
      // 요청을 보낸다. 링크 자체를 커스텀 스킴으로 두지 않는 이유는 앱이 없는 사람도 무언가는
      // 봐야 하기 때문이다(inviteUrl.ts의 `buildInviteAppLink` 주석).
      //
      // TODO: 앱 미설치 시 스토어 이동 — App Links 도메인(assetlinks.json) 설정과 함께 붙인다.
      // 그 설정이 붙으면 web 페이지를 거치지 않고 https 링크가 곧장 앱을 연다(네이티브 재빌드 필요).
      setInviteUrl(buildInviteUrl(teamToken, process.env.EXPO_PUBLIC_WEB_URL, __DEV__, process.env.EXPO_PUBLIC_DEV_WEB_URL));
      setShareError(null);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : String(error));
    }
  }, [teamToken]);

  /**
   * 방 상태를 비우고 미션 인트로로 돌아간다. 아래 두 경로가 공유하는 마지막 동작이다.
   *
   * 미션 id를 함께 넘긴다 — 인트로의 "다시 시작하기"가 그 id로 방을 열기 때문이다(coopIntroRoute).
   */
  const goToIntro = useCallback(() => {
    reset();
    navigate.replace(coopIntroRoute(missionIdForIntro));
  }, [reset, missionIdForIntro]);

  /**
   * 돌아올 방이 **없이** 떠난다 — "포기 할래요", 거절당함, 방이 사라짐.
   *
   * 쉬기 메모를 함께 버린다. 이 경로들은 방에서 실제로 빠지는 것이라 그 메모가 가리키는 방으로
   * 돌아갈 일이 없고, 남겨 두면 판정이 필요 없는 자리에서 계속 대조를 시도한다.
   * (같은 방으로 다시 들어오는 경우에만 대조가 성립한다 — store/coopParty.ts의 resumedAsNewHost)
   */
  const leaveToIntro = useCallback(() => {
    forgetPausedRoom();
    goToIntro();
  }, [forgetPausedRoom, goToIntro]);

  /**
   * "잠깐 쉴게요" — 방을 그대로 두고 나간다(서버에 아무것도 보내지 않는다).
   *
   * 나가던 순간의 **방장 신원**을 남긴다. 쉬는 동안에는 폴링이 꺼져 방장 승계를 볼 수 없고,
   * 그래서 승계를 알아채는 자리가 **다시 시작하는 순간**뿐이다(store/coopParty.ts의 resumedAsNewHost).
   * 쉬는 중에 화면을 끌어오지 않는 것이 이 설계의 요점이다 — 사용자는 미션을 떠나 있다.
   *
   * "내가 방장이었나"(불리언)가 아니라 신원을 넘긴다. 그 불리언은 만들어지는 순간의 판단이
   * 그대로 굳어, 신원이나 목록을 잠깐 모르는 상태에서 false가 되면 승계로 읽혔다 —
   * 혼자 하는 미션에서도 재개할 때마다 "방장이 변경되었어요"가 떴다.
   */
  const pauseMission = useCallback(() => {
    pauseRoom(findHost(participants)?.participantId ?? null);
    goToIntro();
  }, [pauseRoom, participants, goToIntro]);

  // 방이 사라졌으면(방장이 마지막으로 나가 진행도가 삭제됐거나, 내 참여자 행이 지워졌다)
  // 이 화면에 남아 있어 봐야 빈 목록만 보인다. 폴링도 이미 멈춘 상태다.
  useEffect(() => {
    if (statusFailure !== 'gone' && statusFailure !== 'already-completed') return;
    show(COOP_FAILURE_MESSAGE[statusFailure]);
    leaveToIntro();
  }, [statusFailure, show, leaveToIntro]);

  /**
   * 수락·거절. 결과를 받아 실패만 알린다.
   *
   * 성공했을 때 토스트를 띄우지 않는 이유: 목록이 곧바로 바뀌어(배지 또는 줄 사라짐) 결과가 보인다.
   * 거절은 폴링 변화 감지가 "{이름}님의 참여를 거절했어요"를 따로 띄운다.
   */
  const handleAccept = useCallback(
    (participantId: number) => {
      void (async () => {
        const result = await acceptParticipant(participantId);
        if (!result.ok) show(coopFailureMessage(result.failure, result.detail));
      })();
    },
    [acceptParticipant, show],
  );

  const handleReject = useCallback(
    (participantId: number) => {
      void (async () => {
        const result = await rejectParticipant(participantId);
        if (!result.ok) show(coopFailureMessage(result.failure, result.detail));
      })();
    },
    [rejectParticipant, show],
  );

  /**
   * "다음" — 역할 랜덤 배정 저장이 모두 끝난 뒤에야 재료 찾기로 넘어간다.
   *
   * 이동은 여기서 하지 않는다. 저장이 끝나면 `currentStep`이 바뀌고 위의 effect가 옮긴다 —
   * 방장과 팀원이 같은 경로를 타야 한 쪽만 먼저 넘어가는 일이 없다.
   */
  const startMaterials = useCallback(() => {
    // **한 번만 보낸다.** 아래 CTA는 `startInFlight`로 잠기지만 그 잠금은 상태가 반영된 다음
    // 렌더부터 듣는다 — 뮤테이션 사이의 짧은 틈(pending이 잠깐 false가 되는 구간)에 눌린 두 번째
    // 탭까지 여기서 막는다. 배정이 두 번 돌면 이미 저장된 역할이 덮어써진다.
    if (assignInFlightRef.current) return;
    assignInFlightRef.current = true;
    setAssignInFlight(true);

    // 누른 즉시 알린다. 이 화면에 머무는 것이 정상 흐름이라(2단계는 여기다) 아무 안내가 없으면
    // 버튼이 안 먹은 것으로 읽힌다. 폴링이 2단계를 읽어 오는 아래 effect까지 기다리면 최대 2초 늦다.
    showAssigningNotice();

    void (async () => {
      try {
        const result = await assignRolesAndAdvance();
        if (!result.ok) show(coopFailureMessage(result.failure, result.detail));
      } finally {
        // 실패했으면 다시 누를 수 있어야 한다. 성공한 경우에는 이미 3단계라(이 함수가 재조회까지
        // 기다린다) 이 화면을 떠난 뒤이고, 2단계에 남은 경우에는 `coopAssignPhase`가 곧바로
        // `'stalled'`가 되어 방장에게 "다시 역할 나누기"가 열린다 — **시간을 재지 않는다.**
        assignInFlightRef.current = false;
        setAssignInFlight(false);
      }
    })();
  }, [assignRolesAndAdvance, show, showAssigningNotice]);

  // "포기할래요" — 방에서 빠진다. 보상은 받지 못한다.
  const abandonMission = useCallback(() => {
    void (async () => {
      try {
        await leaveRoom();
      } finally {
        // 나가기 요청이 실패해도 화면은 떠난다 — 여기 붙잡아 두면 나갈 방법이 없다.
        leaveToIntro();
      }
    })();
  }, [leaveRoom, leaveToIntro]);

  /**
   * 방을 여는 응답을 아직 못 받았다 — 홈·마이페이지의 "이어서 진행"으로 들어온 경로다.
   *
   * 그 동안에는 **초대 화면 내용을 그리지 않는다.** 어느 단계로 갈지는 이어하기 응답의
   * `currentStep`이 정하는데(useEnterCoopRoom), 응답이 오기 전까지 여기 그려지는 것은 1단계
   * 화면이다 — 3단계 방을 이어했는데도 "참여 멤버 (0/3)"인 빈 초대 화면이 요청 한 번(수백 ms)
   * 동안 스쳐 지나갔다. 게이트를 우회하는 전환으로 **이동은** 확실해졌지만, 그 사이에 보이는
   * 이전 단계 화면은 남아 있었다(사용자 지시: 중간에 미션 홈이나 이전 단계를 거치면 안 된다).
   *
   * 배경만 협동 미션의 것으로 두고 단계 배지·문구를 빼서, 이 대기 자체가 어느 단계로도
   * 읽히지 않게 한다.
   *
   * 스피너에 갇히지는 않는다 — 위 effect의 세 갈래(권한 거부·방 열기 실패·성공)가 모두
   * 화면을 옮기거나 `missionProgressId`를 채우고, 어느 갈래든 `openingRoom`을 내린다.
   * 인트로의 "시작하기"로 들어온 경로는 인트로가 이미 방을 열어 둬서 이 갈래를 타지 않는다.
   *
   * `openingRoom`을 함께 보는 이유: 스토어에 **끝난 방이 남아 있는** 진입에서는
   * `missionProgressId`가 이미 채워져 있어, 그것만 보면 이어하기 응답을 기다리는 동안
   * 옛 방의 참여자 목록이 그대로 그려진다(shouldOpenCoopRoom 주석).
   */
  if (missionProgressId === null || openingRoom) {
    return (
      <FullBleed>
        <View style={[coopStepStyles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
          <LinearGradient colors={COOP_BACKGROUND_COLORS} style={coopStepStyles.background} />
          <LinearGradient colors={COOP_CIRCLE_COLORS} style={coopStepStyles.circle} />
          <ActivityIndicator />
        </View>
      </FullBleed>
    );
  }

  return (
    <CoopStepLayout
      {...COOP_STEP_COPY.invite}
      onBack={cancelGuard.requestExit}
      /**
       * CTA는 세 얼굴을 갖는다(coopStep.ts의 `coopAssignPhase`).
       *
       *   - 배정이 이 기기에서 돌고 있다 → 라벨로 진행을 알리고 잠근다(두 번 돌면 덮어써진다).
       *   - 배정이 끊긴 방에 방장으로 들어왔다 → **"다시 역할 나누기"로 바꿔 열어 준다.**
       *     여기서 잠그면 앞으로 갈 수단이 없어진다(실기기에서 이어하기가 2단계에서 멈췄다).
       *   - 그 외 → 평소의 "다음".
       *
       * **시간을 재지 않는다.** "얼마나 지나야 굳은 것인가"에는 답이 없고, 임의의 타이머는 느린
       * 통신에서 멀쩡한 배정을 중단으로 오판한다. 대신 "이 화면이 배정을 시작했는가"로 가른다 —
       * 배정이 정상으로 끝나면 단계가 3이 되므로, 시작한 적 없는 화면이 2단계를 보고 있다면
       * 그 전이는 끝내 완료되지 않은 것이다.
       *
       * 잠금은 `canStart` 하나만 본다. 그 안에 구간 조건(`actionsOpen` — 배정 중이거나 단계를
       * 모르면 닫힌다)과 명단 조건(`startBlock` — 방장 · 최소 인원 · 대기자 없음)이 모두 들어
       * 있어서, 여기서 조건을 하나 더 얹으면 같은 규칙이 두 곳에 살게 된다.
       */
      ctaText={assignPhase === 'assigning' ? ASSIGNING_CTA_TEXT : canRetryAssign ? ASSIGN_RETRY_CTA_TEXT : '다음'}
      ctaDisabled={!canStart}
      onCtaPress={startMaterials}
    >
      {/* 섹션 헤더는 스크롤 밖에 고정한다 — "참여 멤버 text가 있는 부분까지만 스크롤" */}
      {/* 왼쪽은 제목+문구, 오른쪽은 초대 칩(사용자 제안으로 두 덩어리를 나눴다).
          예전에는 멤버 카드 다음, 목록 안의 점선 버튼이었는데 멤버가 늘수록 아래로 밀려
          스크롤을 끝까지 내려야 보였다. 헤더로 올리면 자리가 고정된다. */}
      <View style={[styles.sectionHeader, styles.sectionHeaderRow]}>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>
            참여 멤버 ({members.length}/{MAX_PARTY_SIZE})
          </Text>
          {/* 방장에게만 "중단됐다"고 말한다 — 팀원은 되살릴 수단이 없어 불안하기만 하다.
              그중에서도 **대기자 때문에 막힌 경우가 먼저다**: 그때 "다시 시도해주세요"만 보이면
              눌리지 않는 버튼을 계속 누르게 된다. */}
          <Text style={styles.minNotice}>{INVITE_NOTICE_TEXT[coopInviteNoticeKind(assignPhase, { canRetryAssign, blockedByPending: startBlock === 'pending' })]}</Text>
        </View>

        {/* 배정이 도는 동안에는 부를 수 없다 — 지금 초대해 들어와도 역할은 버튼을 누른 시점의
            명단으로 이미 나뉘어, 그 사람만 역할 없이 남는다. 끊긴 2단계에서는 막지 않는다:
            거기서는 아직 아무 역할도 나뉘지 않았고, 새로 들어온 사람도 수락하면 이번 배정에 든다. */}
        {iAmHost && <InviteChip disabled={!canInviteMore(participants) || assignPhase === 'assigning'} onPress={handleInvite} />}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {visibleParticipants.map((member) => {
          const isMe = member.participantId === myParticipantId;
          const ready = isParticipantReady(member);
          // 수락·거절은 방장만, 아직 수락하지 않은 남의 카드에만, 그리고 **CTA와 같은 구간에서만**
          // 붙는다(actionsOpen). 판정은 `party.ts`에 있다(canReviewJoinRequest).
          const showActions = canReviewJoinRequest(member, participants, myParticipantId, actionsOpen);

          return (
            <PartyMemberCard
              key={member.participantId}
              name={member.name}
              isHost={member.participantRole === 'HOST'}
              isMe={isMe}
              status={showActions ? undefined : memberStatus(ready, isMe)}
              onAccept={showActions ? () => handleAccept(member.participantId) : undefined}
              onReject={showActions ? () => handleReject(member.participantId) : undefined}
            />
          );
        })}

        {shareError !== null && <Text style={styles.minNotice}>공유를 열지 못했어요: {shareError}</Text>}
      </ScrollView>

      {/* 복사 안내는 **시트가 직접** 띄운다. 여기서 토스트를 올려도 시트가 Modal(Android에서
          별도 윈도우)이라 그 뒤에 가려 보이지 않는다 — 실제로 그 증상으로 확인했다.
          z-index·elevation은 한 윈도우 안에서만 통해서 이 경계를 넘지 못한다. */}
      <InviteShareSheet visible={inviteUrl !== null} inviteUrl={inviteUrl ?? ''} onClose={() => setInviteUrl(null)} onShareError={setShareError} />

      <MissionCancelModal
        visible={cancelGuard.visible}
        // "잠깐 쉴게요" — 방을 그대로 두고 나간다. 방은 IN_PROGRESS로 남아
        // intro의 "시작하기"(이어하기 200)로 되돌아올 수 있다.
        onPause={pauseMission}
        // "포기할래요" — 방에서 빠진다. 보상을 받지 못한다.
        onAbandon={abandonMission}
        onClose={cancelGuard.dismiss}
      />
    </CoopStepLayout>
  );
}

/**
 * "일행 초대" 칩.
 *
 * 안내 문구 옆에 놓이는 **보조 동작**이라 CTA만 한 무게를 가지면 안 된다 — 테두리만 있는
 * 오렌지 칩이다(사용자 지시: chip-outline). 색은 협동 미션 CTA와 같은 #ff8f18.
 *
 * `Button`을 쓰지 않는 이유: 이 칩은 높이·글자 크기·아이콘 배치가 CTA 규격(md/xs)과 달라서
 * 새 size를 만들어야 하는데, 쓰는 곳이 여기 하나뿐이라 공용 컴포넌트를 넓히지 않는다.
 */
function InviteChip({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const handlePress = useSinglePress(onPress);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="일행 초대"
      accessibilityState={{ disabled }}
      style={[styles.inviteChip, disabled && styles.inviteChipDisabled]}
    >
      {/* 24x24 안의 +. 라벨과 같은 색이라 아이콘이 따로 놀지 않는다. 색은 styles.inviteChipLabel과 같은 #ff8f18이다 */}
      <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
        <Path d="M12 5v14M5 12h14" stroke="#ff8f18" strokeWidth={2.4} strokeLinecap="round" />
      </Svg>
      <Text style={styles.inviteChipLabel}>일행 초대</Text>
    </Pressable>
  );
}
