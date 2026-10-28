import { create } from 'zustand';
import type { Participant, RoleCard } from '@packages/shared';
import { findHost } from '@/utils/party';

/**
 * 협동 미션 방의 **클라이언트 값만** 담는 스토어.
 *
 * 서버 상태(참여자·역할·단계)는 여기 두지 않는다. 그건 2초마다 폴링하는 react-query 캐시가
 * 유일한 출처다(`useCoopMissionRoom`). 예전에는 이 스토어가 응답 전체를 들고 mock 계층에서
 * 값을 받았는데, 그러면 같은 정보가 두 곳에 살면서 어느 쪽이 최신인지 알 수 없다.
 *
 * 여기 남는 것은 **폴링 응답만으로는 알 수 없는 것들**뿐이다:
 * 어느 방을 폴링할지(missionProgressId), 공유할 초대 토큰(teamToken),
 * 그리고 변화 감지를 위한 직전 스냅샷.
 */
/**
 * "잠깐 쉴게요"로 방을 떠나던 순간의 메모.
 *
 * 쉬는 동안에는 폴링이 꺼져 있어(`missionProgressId`가 null이라 쿼리 자체가 disabled)
 * 방장이 나가 승계가 일어나도 앱은 그것을 **볼 수 없다.** 그래서 나가던 순간의 사실
 * ("어느 방이었고, 그때 내가 방장이었나")만 남겨 두었다가 다시 들어올 때 대조한다.
 */
export interface PausedCoopRoom {
  missionProgressId: number;
  /**
   * 쉬러 나가던 순간의 **방장 participantId**. 돌아왔을 때의 방장과 비교할 기준이다.
   *
   * 예전에는 `wasHost: boolean`이었다. 파생 불리언을 저장하면 그것을 만든 시점의 판단이
   * 그대로 굳어 버려, 나중에 무엇과 비교해도 근거가 되지 못한다 — 실제로 그 값이 false로
   * 떨어지는 순간(내 신원을 아직 모르거나 목록이 비어 있을 때)마다 승계로 읽혔다.
   * 폴링 응답이 언제나 `participantRole: HOST | MEMBER`를 주므로 방장 신원은 늘 알 수 있고,
   * **두 시점의 신원을 비교하는 것**이 승계의 정의 그대로다.
   *
   * 모르면 null이다(폴링이 한 번도 응답하지 않은 채 쉬었다). 그때는 비교할 기준이 없어
   * 승계를 판정하지 않는다 — 모르는 것을 안다고 말하지 않는다.
   */
  hostParticipantId: number | null;
  /**
   * 쉬러 나가던 순간의 **내 participantId**.
   *
   * `reset()`이 스토어의 `myParticipantId`를 지우므로(쉬기는 곧 reset이다) 재개 시점에는
   * 내 신원이 비어 있다. 이어하기 응답에도 `currentParticipant`가 없어(party.ts의
   * `soleParticipantId`) 첫 폴링 전까지는 알 수 없다. 참여자 id는 방 안에서 변하지 않으므로
   * 나가던 순간의 값을 그대로 들고 있다가 대조한다.
   */
  myParticipantId: number | null;
}

/**
 * 쉬었다 돌아온 방에서 **내가 새 방장이 되어 있는지**.
 *
 * 판정을 순수 함수로 떼어 둔다 — 스토어 안에 두면 이 규칙만 따로 검증할 수 없다.
 *
 * 승계의 정의는 "쉬기 전에는 방장이 다른 사람이었는데, 돌아와 보니 그 자리가 나"다.
 * 그래서 **두 시점의 방장 신원을 비교한다.** 다음을 모두 만족해야 참이다:
 *   1. 쉬기 메모가 있다 — "포기 할래요"로 나갔으면 메모를 지우므로 여기서 걸린다.
 *      포기는 방에서 실제로 빠지는 것이라 다시 시작하면 **새 방**이고, 그 방의 방장이 나인 것은
 *      승계가 아니라 당연한 결과다. 그때 "방장이 변경되었어요"가 뜨면 거짓말이 된다.
 *   2. 같은 방이다 — 다른 방을 열었다면 이전 방의 승계와 아무 상관이 없다.
 *   3. 쉬던 순간의 방장과 내 신원을 둘 다 알고 있다 — 하나라도 모르면 비교가 성립하지 않는다.
 *   4. 지금 방장이 그때의 방장과 **다른 사람**이고, 그 사람이 나다.
 *
 * **`myParticipantId`를 인자로 받지 않는다.** 예전에는 이어하기 직후의 스토어 값과
 * `isHost(participants, myParticipantId)`로 비교했는데, 그 값 자체가 `findHost(participants)`로
 * 정해진 값이라 동어반복이었다("방장을 나로 정해 두고 내가 방장인지 묻는다"). 그래서 3번 조건이
 * 사실상 언제나 참이었고, 혼자 하는 미션에서도 재개할 때마다 승계 안내가 떴다.
 */
export function resumedAsNewHost(paused: PausedCoopRoom | null, missionProgressId: number, participants: Participant[] | undefined): boolean {
  if (paused === null) return false;
  if (paused.missionProgressId !== missionProgressId) return false;
  // 쉬던 순간의 방장이나 내 신원을 모르면 대조할 기준이 없다
  if (paused.hostParticipantId === null || paused.myParticipantId === null) return false;
  // 참여자 목록이 없는 응답(게스트 참여 요청)에서는 방장을 판정할 근거가 없다
  if (participants === undefined) return false;

  const host = findHost(participants);
  if (host === null) return false;
  // 방장이 그대로면 승계가 없었다 — 혼자 하는 미션(방장이 처음부터 끝까지 나)이 여기서 걸린다
  if (host.participantId === paused.hostParticipantId) return false;

  // 방장이 A→B로 바뀌었어도 그 B가 내가 아니면 "내가 방장이 되었다"는 안내는 틀린 말이다
  return host.participantId === paused.myParticipantId;
}

/**
 * 협동 미션 첫 화면에 들어왔을 때 **서버에 방을 다시 물어야 하는지**.
 *
 * 예전 규칙은 "스토어에 방이 있으면 열지 않는다" 하나였는데, 그 규칙은 **스토어에 남아 있는 방이
 * 언제나 지금 들어온 미션의 방이라는 가정**에 기대고 있었다. 그 가정이 성립하지 않는다:
 * 완료 화면은 이 스토어를 건드리지 않아서(app/mission/complete.tsx) 미션을 한 번 끝내면
 * **끝난 방이 앱을 켜 둔 내내 그대로 남는다.** 그 상태로 홈의 "이어서 진행"을 누르면
 * 이어하기 요청(`POST /api/v1/cooperative-missions/{id}/progress`)이 아예 나가지 않고,
 * 화면은 남아 있던 끝난 방을 폴링해 그 방의 `currentStep`(4)을 읽어 곧바로 완료 화면으로 넘어간다.
 * "홈에서는 1/4인데 누르면 1단계를 스쳐 완료 화면"이 정확히 이 경로다.
 *
 * 그래서 기준을 "방이 있는가"에서 **"어느 미션으로 들어왔는가"**로 바꾼다. 라우트에 `missionId`가
 * 실려 있으면 홈·마이페이지의 "이어서 진행"으로 들어온 것이고(missionNavigateTarget.ts ·
 * HomeWebView/useHomeBridge.ts가 그때만 파라미터를 싣는다), 그 경로에서 **어느 방을 볼지는
 * 서버가 정해야 한다.** 이어하기는 멱등해서 같은 방이면 200으로 그 방을 그대로 돌려주므로
 * (CooperativeMissionStartResponse 설명) 다시 물어서 손해 볼 것이 없다.
 *
 * 파라미터가 없는 진입은 예전 규칙 그대로다 — 인트로의 "시작하기"(인트로가 이미 방을 열었다)와
 * 재료 찾기 화면이 되돌려보낸 경우(같은 방이 확실하다)뿐이라, 방이 있으면 그 방을 계속 본다.
 */
export function shouldOpenCoopRoom(missionProgressId: number | null, resumeMissionId: string | undefined): boolean {
  return missionProgressId === null || resumeMissionId !== undefined;
}

/** 아직 아무것도 정하지 않았다는 뜻. `null`(열지 않는다)과 구분해야 해서 따로 있는 값이다 */
export const COOP_ROOM_UNDECIDED = 'undecided';

/**
 * 이 진입에서 **열 방의 미션 id**. `null`이면 열지 않는다(이미 들어와 있는 방을 그대로 본다).
 *
 * **진입 시점에 한 번 정하고 그 뒤로는 바뀌지 않는다.** `decided`가 `COOP_ROOM_UNDECIDED`가
 * 아니면 그 값을 그대로 돌려주는 것이 이 함수의 전부이고, 그 "한 번"이 규칙의 핵심이다.
 *
 * 이유는 `shouldOpenCoopRoom`이 **`missionProgressId`를 읽기 때문**이다. 그 값은 화면이 사는
 * 동안 바뀐다 — "잠깐 쉴게요"가 `reset()`으로 방을 비우는 순간 `null`이 된다. 그러면 같은
 * 판정이 **거짓에서 참으로 뒤집히고**, 그것을 매 렌더 다시 물으면 떠나려는 화면이 방을 새로 연다.
 *
 * 실기기에서 확인된 되먹임이 정확히 이 경로다(초대 화면에서 쉬기 → 인트로 → 곧바로 미션 화면):
 *   1. 초대 화면은 라우트 파라미터 없이 열려 있다(인트로의 "시작하기", 초대 링크 참여,
 *      그리고 홈의 "이어서 진행"이 `useEnterCoopRoom`으로 갈아 끼운 두 번째 진입이 모두 그렇다).
 *      방이 있고 파라미터가 없으니 `shouldOpenCoopRoom`은 거짓 → 열 방 없음.
 *   2. "잠깐 쉴게요" → `reset()` + 인트로로 `replace`. **그런데 expo-router의 imperative
 *      전환은 큐에 쌓였다가 다음 effect에서 dispatch된다**(expo-router/build/imperative-api.js의
 *      `useImperativeApiEmitter`). 그래서 `reset()`이 만든 렌더가 **화면이 아직 살아 있는 채로**
 *      먼저 커밋된다.
 *   3. 그 렌더에서 `missionProgressId`가 null이 되어 판정이 참으로 뒤집히고, 열 방이
 *      `null → resolveMissionId(undefined) = 폴백 1`로 바뀐다. 그 값을 의존성으로 쓰는 effect가
 *      돌아 **1번 협동 미션의 방을 새로 열고** 곧바로 미션 화면으로 `replace`한다.
 *   4. 사용자 눈에는 "인트로로 갔다가 곧바로 다시 미션 화면"으로 보인다. 실제로 인트로에는
 *      갔다(2의 전환은 정상 dispatch됐다) — 되돌아온 것이지 못 나간 것이 아니다.
 *
 * 심사위원용 모드와 무관하다. 이 판정에 들어오는 값은 스토어의 방 id와 라우트 파라미터뿐이라
 * 가짜 팀원·고정 좌표·심사위원 토큰 중 어느 것도 결과를 바꾸지 않는다.
 */
export function coopRoomToOpen(decided: number | null | typeof COOP_ROOM_UNDECIDED, missionProgressId: number | null, resumeMissionId: string | undefined, missionId: number): number | null {
  if (decided !== COOP_ROOM_UNDECIDED) return decided;
  return shouldOpenCoopRoom(missionProgressId, resumeMissionId) ? missionId : null;
}

interface CoopPartyStore {
  /** 폴링 대상. null이면 아직 방에 들어가지 않았다 */
  missionProgressId: number | null;
  /** 방장이 초대 URL을 조립할 때 쓴다. 게스트로 들어온 경우에는 없다 */
  teamToken: string | null;
  /**
   * 나를 참여자 목록에서 식별하는 값.
   *
   * 폴링 응답의 `currentParticipant`(서버가 Bearer 토큰으로 식별)가 오면 그 값으로 덮어쓴다.
   * 그전까지는 참여 응답의 `participantId`(게스트) 또는 참여자가 한 명뿐인 방 생성 응답
   * (`soleParticipantId`)에서 받은 값을 쓴다 — 첫 폴링 전에도 화면이 "나"를 그려야 한다.
   *
   * **추측으로 채우지 않는다.** 근거가 없으면 null로 둔다. 이 값이 틀리면 방장 전용 UI가
   * 멤버에게 열리고 "나의 역할"에 남의 역할이 그려진다(party.ts의 `soleParticipantId` 주석).
   */
  myParticipantId: number | null;
  /** becameHost·wasRemoved 판정을 위한 직전 폴링 스냅샷 */
  previousParticipants: Participant[] | null;
  /**
   * 역할 카드 6종.
   *
   * 서버 상태인데 예외적으로 여기 둔다 — **폴링 응답은 1단계에서 `roleCards`를 `null`로 준다.**
   * 그런데 역할 랜덤 배정은 1단계의 "다음"에서 일어나므로 그 시점에 카드가 필요하다.
   * 방 생성·이어하기 응답이 유일하게 카드를 주는 곳이라 그 값을 받아 둔다.
   * 2단계부터는 폴링이 같은 값을 주므로 그때는 폴링 값을 쓴다.
   */
  roleCards: RoleCard[];
  /**
   * 방에 들어간 직후의 참여자 목록.
   *
   * 같은 이유로 둔다 — 화면은 폴링 결과를 그리는데 **첫 폴링은 최대 2초 뒤에 온다.**
   * 그 사이 초대 화면이 빈 목록을 그리면 방장이 "시작하기"를 누른 직후 자기 자신도 보이지 않는다.
   * 방 생성·이어하기 응답이 이미 참여자를 주므로 그 값으로 화면을 먼저 채운다.
   * 폴링이 한 번이라도 응답하면 그때부터는 폴링 값이 이긴다(이 값은 다시 쓰이지 않는다).
   */
  participants: Participant[];

  /**
   * 시뮬레이션 팀원 중 방장이 수락한 id.
   *
   * 가짜 참여자라 서버에 수락 요청을 보낼 수 없다(존재하지 않는 id로 404가 난다).
   * 그래서 수락 여부를 여기서 들고 있다가 폴링 응답 위에 덧씌운다.
   */
  acceptedSimulatedIds: number[];
  /** 시뮬레이션 팀원 중 방장이 거절한 id. 목록에서 지우는 데만 쓴다 */
  rejectedSimulatedIds: number[];

  /**
   * "잠깐 쉴게요"로 나가던 순간의 메모. **`reset()`이 지우지 않는 유일한 값이다** —
   * 쉬기는 방을 닫는 것이 아니라 잠시 떠나는 것이라, 돌아왔을 때 대조할 것이 남아야 한다.
   */
  pausedRoom: PausedCoopRoom | null;
  /**
   * 쉬는 동안 방장이 바뀌었다는 안내가 아직 뜨지 않았는지.
   *
   * **화면을 바꾸지 않는다.** 어느 단계로 갈지는 이어하기 응답의 `currentStep`이 정하고
   * (`useEnterCoopRoom`), 이 값은 그렇게 도착한 화면이 토스트를 한 번 띄우는 데만 쓴다.
   * 쉬는 중에 곧바로 화면을 끌어오지 않는 이유가 그것이다 — 사용자는 미션을 떠나 있는 상태다.
   *
   * 화면에 **머무는 동안**의 승계는 이 값이 아니라 폴링이 잡는다(`useCoopPartyChanges`).
   * 상태 조회 응답에 참여자 목록과 방장이 들어 있어 그쪽이 훨씬 빠르고 정확하다.
   * 이 값은 그 폴링이 **꺼져 있던 구간**만 메운다 — 둘은 서로를 대체하지 못한다.
   */
  hostChangedWhilePaused: boolean;

  /**
   * "역할을 랜덤으로 정하고 있어요" 안내를 **이 방 진입에서 이미 띄웠는지.**
   *
   * **화면 안의 ref가 아니라 스토어에 두는 이유가 있다.** 그 안내는 초대 화면(together.tsx)이
   * 띄우는데, 홈의 "이어서 진행"으로 들어오면 그 화면이 **한 진입에 두 번 마운트된다** —
   * `/mission/together?missionId=N`으로 먼저 들어오고(첫 인스턴스), 이어하기 응답이 2단계를
   * 주면 `useEnterCoopRoom`이 `/mission/together`(파라미터 없음)로 갈아 끼워(둘째 인스턴스)
   * 같은 화면이 새 인스턴스로 다시 마운트되기 때문이다. 마운트마다 새로 생기는 ref로는
   * 그 두 번을 하나로 묶을 수 없어 **같은 토스트가 두 번 떴다**(실기기에서 확인).
   *
   * `reset()`이 지운다 — 방을 떠나면 다음 진입은 새 진입이고, 그때는 다시 알려야 한다.
   * 그래서 EMPTY에 들어 있고, `pausedRoom`처럼 남겨 두지 않는다.
   */
  roleAssignNoticeShown: boolean;

  /** 방 생성(방장) 또는 참여 요청(게스트) 응답을 받은 직후 */
  enterRoom: (room: { missionProgressId: number; teamToken?: string | null; myParticipantId?: number | null; roleCards?: RoleCard[]; participants?: Participant[] }) => void;
  /** 폴링이 알려준 내 participantId로 갱신 */
  setMyParticipantId: (participantId: number) => void;
  /** 변화 감지용 스냅샷 갱신. 폴링 응답을 화면에 반영한 뒤 호출한다 */
  rememberParticipants: (participants: Participant[]) => void;
  acceptSimulated: (participantId: number) => void;
  rejectSimulated: (participantId: number) => void;
  /**
   * "잠깐 쉴게요" — 나가던 순간의 방과 **그때의 방장 신원**을 남긴다.
   * 호출부가 곧이어 `reset()`을 부른다.
   *
   * 내 신원은 스토어가 이미 들고 있으므로 받지 않는다(`myParticipantId`).
   * 방장은 폴링 응답에서만 알 수 있어 화면이 `findHost(participants)`로 뽑아 넘긴다.
   */
  pauseRoom: (hostParticipantId: number | null) => void;
  /** "포기 할래요"·거절당함·방 사라짐 — 돌아올 방이 없으므로 메모를 버린다 */
  forgetPausedRoom: () => void;
  /** 방장 교체 안내를 띄운 화면이 부른다. 한 번만 뜨게 하는 장치다 */
  consumeHostChangeNotice: () => void;
  /** 역할 배정 안내를 띄운 화면이 부른다. 같은 진입에서 두 번 뜨지 않게 하는 장치다 */
  markRoleAssignNoticeShown: () => void;
  reset: () => void;
}

const EMPTY = {
  missionProgressId: null,
  teamToken: null,
  myParticipantId: null,
  previousParticipants: null,
  roleCards: [] as RoleCard[],
  participants: [] as Participant[],
  acceptedSimulatedIds: [] as number[],
  rejectedSimulatedIds: [] as number[],
  // 안내는 방에 들어올 때마다 다시 계산된다(enterRoom). 방을 떠나면 띄울 자리도 없으므로 내린다.
  hostChangedWhilePaused: false,
  // 같은 이유로 여기 둔다 — 방을 떠나면 이 진입의 안내 이력도 함께 끝난다.
  roleAssignNoticeShown: false,
};

export const useCoopPartyStore = create<CoopPartyStore>((set, get) => ({
  ...EMPTY,
  // **EMPTY에 넣지 않는다.** `reset()`이 `...EMPTY`를 그대로 덮어쓰므로 여기 들어가면
  // "쉬기 → reset → 다시 시작"의 중간에서 메모가 지워져 방장 교체를 영영 알 수 없다.
  pausedRoom: null,

  enterRoom: ({ missionProgressId, teamToken, myParticipantId, roleCards, participants }) => {
    const previous = get();
    /**
     * 신원은 **방 단위**로만 이어받는다.
     *
     * participantId는 진행도 안에서만 뜻이 있는 값이라, 다른 방으로 들어가면서 들고 가면
     * 그 방의 엉뚱한 참여자와 우연히 같은 번호가 되어 "나"가 남을 가리킬 수 있다.
     * 같은 방으로 다시 들어오는 경우(이어하기)에만 직전 값을 유지한다.
     */
    const sameRoom = previous.missionProgressId === missionProgressId;
    const nextMyParticipantId = myParticipantId ?? (sameRoom ? previous.myParticipantId : null);

    set({
      missionProgressId,
      // 게스트 참여 응답에는 토큰도 역할 카드도 없다. 방장이 받아 둔 값을 지우지 않는다.
      teamToken: teamToken ?? previous.teamToken,
      myParticipantId: nextMyParticipantId,
      roleCards: roleCards ?? previous.roleCards,
      participants: participants ?? previous.participants,
      /**
       * **변화 감지 스냅샷을 버린다.** 방에 들어오는 것은 폴링과 폴링 사이의 변화가 아니다.
       *
       * 남겨 두면 **지난 방의 명단과 이번 방의 첫 응답을 비교한다.** 그 비교는 반드시 거짓
       * 양성을 낸다 — 지난 방 사람들은 이번 목록에 없으니 전원이 "나갔다"로 읽히고
       * (`removedParticipants`), 방장도 다른 사람이니 "방장이 바뀌었다"로 읽힌다(`becameHost`).
       * 실기기에서 **협동 미션을 처음 시작하는데** "방장이 퇴장하여 방장이 변경되었어요"와
       * "○○님의 참여를 거절했어요"가 함께 떴고, 그 ○○가 심사위원용 모드의 가짜 팀원 이름이었다 —
       * 직전 방에서 남은 스냅샷이 그대로 비교 대상이 됐다는 증거다.
       *
       * `reset()`이 이미 비우지만 그것으로는 부족하다. 인트로의 "시작하기"는 `reset()` 없이
       * 곧장 `start()` → 여기로 들어오는 유일한 경로다(useEnterCoopRoom.ts).
       *
       * 비워 두면 이번 방의 첫 응답은 비교 대상이 없어 아무것도 알리지 않는다(party.ts의
       * `prev === null` 갈래). 쉬는 동안 일어난 승계는 아래 `hostChangedWhilePaused`가 따로 맡는다.
       */
      previousParticipants: null,
      /**
       * 쉬는 동안 방장이 바뀌었는지는 **여기서만** 판정한다.
       *
       * 폴링 사이의 변화를 보는 `becameHost`로는 이 경우를 잡을 수 없다 — 쉬는 동안 폴링이
       * 꺼져 있어 직전 스냅샷(previousParticipants)이 `reset()`으로 비어 있고, 그러면
       * 첫 응답을 "변화 없음"으로 읽는다. 이어하기 응답이 승계를 처음 알게 되는 자리다.
       *
       * 매번 다시 계산하므로 지난 방의 안내가 다음 방으로 새지 않는다.
       *
       * 판정에 방금 정한 `nextMyParticipantId`를 쓰지 않는 것이 중요하다 — 그 값은 이 응답에서
       * 추론한 값이라, 그것으로 "내가 방장인가"를 물으면 동어반복이 된다(resumedAsNewHost 주석).
       * 대신 쉬기 메모에 남겨 둔 그때의 방장·내 신원과 이 응답의 방장을 대조한다.
       */
      hostChangedWhilePaused: resumedAsNewHost(previous.pausedRoom, missionProgressId, participants),
      // 메모는 한 번 쓰고 버린다. 남겨 두면 같은 방을 다시 열 때마다 같은 안내가 다시 뜬다.
      pausedRoom: null,
    });
  },

  setMyParticipantId: (participantId) => {
    if (get().myParticipantId === participantId) return;
    set({ myParticipantId: participantId });
  },

  rememberParticipants: (participants) => {
    // 같은 배열이면 건너뛴다 — 폴링마다 새 참조를 넣으면 변화 감지 effect가 2초마다 다시 돈다
    if (get().previousParticipants === participants) return;
    set({ previousParticipants: participants });
  },

  acceptSimulated: (participantId) => {
    const { acceptedSimulatedIds } = get();
    if (acceptedSimulatedIds.includes(participantId)) return;
    set({ acceptedSimulatedIds: [...acceptedSimulatedIds, participantId] });
  },

  rejectSimulated: (participantId) => {
    const { rejectedSimulatedIds, acceptedSimulatedIds } = get();
    if (rejectedSimulatedIds.includes(participantId)) return;
    set({
      rejectedSimulatedIds: [...rejectedSimulatedIds, participantId],
      acceptedSimulatedIds: acceptedSimulatedIds.filter((id) => id !== participantId),
    });
  },

  pauseRoom: (hostParticipantId) => {
    const { missionProgressId, myParticipantId } = get();
    // 방이 없으면 돌아올 곳도 없다(아직 열지 못했거나 이미 나간 뒤다)
    if (missionProgressId === null) return;
    set({ pausedRoom: { missionProgressId, hostParticipantId, myParticipantId } });
  },

  forgetPausedRoom: () => {
    if (get().pausedRoom === null) return;
    set({ pausedRoom: null });
  },

  consumeHostChangeNotice: () => {
    if (!get().hostChangedWhilePaused) return;
    set({ hostChangedWhilePaused: false });
  },

  markRoleAssignNoticeShown: () => {
    // 이미 true면 건드리지 않는다 — 같은 값을 다시 넣으면 구독 중인 화면이 공연히 다시 그려진다
    if (get().roleAssignNoticeShown) return;
    set({ roleAssignNoticeShown: true });
  },

  // `pausedRoom`은 EMPTY에 없으므로 여기서 지워지지 않는다(위 초기화 주석 참고).
  reset: () => set({ ...EMPTY }),
}));
