import { beforeEach, describe, expect, it } from 'vitest';
import type { Participant } from '@packages/shared';
import { simulateParticipants } from '@/utils/coopDevSimulation';
import { becameHost, removedParticipants } from '@/utils/party';
import { COOP_ROOM_UNDECIDED, coopRoomToOpen, resumedAsNewHost, shouldOpenCoopRoom, useCoopPartyStore } from './coopParty';

/**
 * "쉬었다 다시 시작했더니 방장이 바뀌어 있었다"를 알아내는 경로의 테스트.
 *
 * 이 판정이 폴링(`becameHost`)으로는 불가능하다는 것이 핵심이다 — 쉬는 동안에는
 * `missionProgressId`가 비어 폴링이 아예 돌지 않고, 직전 스냅샷도 `reset()`으로 사라진다.
 * 그래서 나가던 순간의 메모와 이어하기 응답을 대조하는 이 규칙이 유일한 근거다.
 *
 * **거짓 안내가 실기기에서 나온 뒤 케이스를 늘렸다.** 예전 규칙은 `wasHost` 불리언과
 * `isHost(participants, myParticipantId)`로 판정했는데, 그 `myParticipantId`가 같은 응답의
 * 방장으로 정해진 값이라 동어반복이었다 — 혼자 하는 미션에서도 재개할 때마다
 * "방장이 퇴장하여 방장이 변경되었어요"가 떴다. 지금은 두 시점의 **방장 신원**을 비교한다.
 */

function participant(participantId: number, role: 'HOST' | 'MEMBER'): Participant {
  return { participantId, name: `참여자${participantId}`, participantRole: role, participantStatus: 'ACCEPTED' };
}

const ME = 2;
const OTHER_HOST = 1;
/** 방장이 나가 내가 승계된 뒤의 목록 */
const AFTER_HANDOVER: Participant[] = [participant(ME, 'HOST')];
/** 나가던 시점의 목록 — 방장은 1번이고 나는 일행이다 */
const BEFORE_HANDOVER: Participant[] = [participant(OTHER_HOST, 'HOST'), participant(ME, 'MEMBER')];
/** 혼자 하는 미션 — 처음부터 끝까지 방장이 나 하나뿐이다 */
const SOLO: Participant[] = [participant(ME, 'HOST')];

/** 일행으로 쉬던 순간의 메모(방장은 남, 나는 멤버) */
const PAUSED_AS_MEMBER = { missionProgressId: 10, hostParticipantId: OTHER_HOST, myParticipantId: ME };
/** 방장인 채로 쉬던 순간의 메모 */
const PAUSED_AS_HOST = { missionProgressId: 10, hostParticipantId: ME, myParticipantId: ME };

describe('resumedAsNewHost', () => {
  it('쉬기 메모가 없으면 거짓 — 포기하고 나갔거나 처음 여는 방이다', () => {
    expect(resumedAsNewHost(null, 10, AFTER_HANDOVER)).toBe(false);
  });

  it('혼자 하는 미션은 거짓 — 방장이 처음부터 나였고 바뀐 적이 없다', () => {
    // 실기기에서 나온 거짓 안내가 정확히 이 경우였다. 승계가 일어날 수 없는 상황이다.
    expect(resumedAsNewHost(PAUSED_AS_HOST, 10, SOLO)).toBe(false);
  });

  it('방장인 채로 쉬었다 돌아오면 거짓 — 승계가 일어난 적이 없다', () => {
    expect(resumedAsNewHost(PAUSED_AS_HOST, 10, AFTER_HANDOVER)).toBe(false);
  });

  it('다른 방을 열면 거짓 — 이전 방의 승계와 상관이 없다', () => {
    expect(resumedAsNewHost(PAUSED_AS_MEMBER, 11, AFTER_HANDOVER)).toBe(false);
  });

  it('돌아왔는데도 방장이 그대로면 거짓', () => {
    expect(resumedAsNewHost(PAUSED_AS_MEMBER, 10, BEFORE_HANDOVER)).toBe(false);
  });

  it('방장이 남에게 넘어갔으면 거짓 — 새 방장이 내가 아니다', () => {
    // A가 나가고 3번이 방장이 됐지만 나는 여전히 멤버다. "내가 방장이 되었다"는 틀린 말이다.
    const otherBecameHost: Participant[] = [participant(3, 'HOST'), participant(ME, 'MEMBER')];
    expect(resumedAsNewHost(PAUSED_AS_MEMBER, 10, otherBecameHost)).toBe(false);
  });

  it('참여자 목록이 비어 있으면 거짓 — 방장을 판정할 근거가 없다', () => {
    expect(resumedAsNewHost(PAUSED_AS_MEMBER, 10, [])).toBe(false);
  });

  it('참여자 목록이 없으면 거짓 — 방장을 판정할 근거가 없다(게스트 참여 응답)', () => {
    expect(resumedAsNewHost(PAUSED_AS_MEMBER, 10, undefined)).toBe(false);
  });

  it('쉬던 순간의 방장을 몰랐으면 거짓 — 대조할 기준이 없다', () => {
    expect(resumedAsNewHost({ missionProgressId: 10, hostParticipantId: null, myParticipantId: ME }, 10, AFTER_HANDOVER)).toBe(false);
  });

  it('쉬던 순간의 내 신원을 몰랐으면 거짓 — 새 방장이 나인지 말할 수 없다', () => {
    expect(resumedAsNewHost({ missionProgressId: 10, hostParticipantId: OTHER_HOST, myParticipantId: null }, 10, AFTER_HANDOVER)).toBe(false);
  });

  it('일행으로 쉬었다가 같은 방에 방장으로 돌아오면 참', () => {
    expect(resumedAsNewHost(PAUSED_AS_MEMBER, 10, AFTER_HANDOVER)).toBe(true);
  });
});

describe('쉬기 → 다시 시작', () => {
  beforeEach(() => {
    useCoopPartyStore.getState().reset();
    useCoopPartyStore.getState().forgetPausedRoom();
    useCoopPartyStore.getState().consumeHostChangeNotice();
  });

  /** 화면이 하는 일과 같은 순서: 메모를 남기고 방 상태를 비운다 */
  function pauseAt(missionProgressId: number, participants: Participant[], hostParticipantId: number | null) {
    const store = useCoopPartyStore.getState();
    store.enterRoom({ missionProgressId, myParticipantId: ME, participants });
    // 화면은 폴링 목록에서 방장을 뽑아 넘긴다(findHost(participants)?.participantId ?? null)
    store.pauseRoom(hostParticipantId);
    store.reset();
  }

  it('reset()이 쉬기 메모를 지우지 않는다 — 지우면 돌아왔을 때 대조할 것이 없다', () => {
    pauseAt(10, BEFORE_HANDOVER, OTHER_HOST);
    expect(useCoopPartyStore.getState().pausedRoom).toEqual({ missionProgressId: 10, hostParticipantId: OTHER_HOST, myParticipantId: ME });
    expect(useCoopPartyStore.getState().missionProgressId).toBeNull();
  });

  it('일행으로 쉬었다가 방장으로 돌아오면 안내 플래그가 켜진다', () => {
    pauseAt(10, BEFORE_HANDOVER, OTHER_HOST);
    useCoopPartyStore.getState().enterRoom({ missionProgressId: 10, participants: AFTER_HANDOVER });

    expect(useCoopPartyStore.getState().hostChangedWhilePaused).toBe(true);
    // 메모는 한 번 쓰고 버린다 — 남으면 같은 방을 다시 열 때마다 안내가 되살아난다
    expect(useCoopPartyStore.getState().pausedRoom).toBeNull();
  });

  it('안내는 한 번만 뜬다 — 소비한 뒤에는 플래그가 내려간다', () => {
    pauseAt(10, BEFORE_HANDOVER, OTHER_HOST);
    useCoopPartyStore.getState().enterRoom({ missionProgressId: 10, participants: AFTER_HANDOVER });
    useCoopPartyStore.getState().consumeHostChangeNotice();

    expect(useCoopPartyStore.getState().hostChangedWhilePaused).toBe(false);
  });

  it('포기하고 나갔으면(메모를 버렸으면) 새 방에서 안내가 뜨지 않는다', () => {
    const store = useCoopPartyStore.getState();
    store.enterRoom({ missionProgressId: 10, myParticipantId: ME, participants: BEFORE_HANDOVER });
    // 화면의 "포기 할래요" 경로: 메모를 남기지 않고 버린다
    store.forgetPausedRoom();
    store.reset();

    // 다시 시작하면 새 방이 열리고 그 방의 방장은 당연히 나다 — 승계가 아니다
    store.enterRoom({ missionProgressId: 11, myParticipantId: ME, participants: AFTER_HANDOVER });
    expect(useCoopPartyStore.getState().hostChangedWhilePaused).toBe(false);
  });

  it('방장인 채로 쉬었다 돌아오면 안내가 없다', () => {
    pauseAt(10, AFTER_HANDOVER, ME);
    useCoopPartyStore.getState().enterRoom({ missionProgressId: 10, participants: AFTER_HANDOVER });

    expect(useCoopPartyStore.getState().hostChangedWhilePaused).toBe(false);
  });

  it('혼자 하는 미션을 쉬었다 이어해도 안내가 없다', () => {
    // 참여자가 나 하나뿐이라 이어하기 응답만으로 신원이 확정된다(soleParticipantId).
    // 그래도 방장이 바뀐 적이 없으므로 안내는 뜨지 않아야 한다.
    pauseAt(10, SOLO, ME);
    useCoopPartyStore.getState().enterRoom({ missionProgressId: 10, participants: SOLO });

    expect(useCoopPartyStore.getState().hostChangedWhilePaused).toBe(false);
  });

  it('방이 없으면 쉬기 메모를 남기지 않는다', () => {
    useCoopPartyStore.getState().pauseRoom(OTHER_HOST);
    expect(useCoopPartyStore.getState().pausedRoom).toBeNull();
  });
});

/**
 * 신원(`myParticipantId`)은 **방 안에서만** 뜻이 있는 값이다.
 *
 * 다른 방으로 들어가면서 이월하면 그 방의 엉뚱한 참여자와 우연히 같은 번호가 되어
 * "나"가 남을 가리킬 수 있고, 그러면 방장 전용 UI와 "나의 역할"이 통째로 어긋난다.
 */
describe('enterRoom의 신원 이월', () => {
  beforeEach(() => {
    useCoopPartyStore.getState().reset();
    useCoopPartyStore.getState().forgetPausedRoom();
  });

  it('같은 방으로 다시 들어오면 직전 신원을 유지한다 — 이어하기 응답은 나를 알려주지 않는다', () => {
    const store = useCoopPartyStore.getState();
    store.enterRoom({ missionProgressId: 10, myParticipantId: ME, participants: BEFORE_HANDOVER });
    store.enterRoom({ missionProgressId: 10, participants: BEFORE_HANDOVER });

    expect(useCoopPartyStore.getState().myParticipantId).toBe(ME);
  });

  it('다른 방으로 들어가면 신원을 버린다 — 첫 폴링의 currentParticipant가 다시 정한다', () => {
    const store = useCoopPartyStore.getState();
    store.enterRoom({ missionProgressId: 10, myParticipantId: ME, participants: BEFORE_HANDOVER });
    store.enterRoom({ missionProgressId: 11, participants: BEFORE_HANDOVER });

    expect(useCoopPartyStore.getState().myParticipantId).toBeNull();
  });
});

/**
 * "홈에서는 1/4인데 누르면 1단계를 스쳐 완료 화면으로 간다"의 원인이 된 규칙.
 *
 * 완료 화면이 이 스토어를 비우지 않아(app/mission/complete.tsx) 미션을 한 번 끝내면 끝난 방이
 * 그대로 남는데, 예전 규칙("방이 있으면 열지 않는다")은 그 방을 이번 진입의 방으로 착각해
 * 이어하기 요청을 아예 보내지 않았다. 그러면 화면은 끝난 방(4단계)을 폴링해 곧장 완료 화면으로 넘어간다.
 */
describe('shouldOpenCoopRoom', () => {
  it('방이 없으면 연다 — 파라미터가 없어도(인트로를 거치지 않은 진입) 열 방이 필요하다', () => {
    expect(shouldOpenCoopRoom(null, undefined)).toBe(true);
    expect(shouldOpenCoopRoom(null, '7')).toBe(true);
  });

  it('파라미터 없이 방이 있으면 열지 않는다 — 인트로가 방금 연 방이거나 재료 찾기가 되돌려보낸 같은 방이다', () => {
    expect(shouldOpenCoopRoom(10, undefined)).toBe(false);
  });

  it('"이어서 진행"(missionId 파라미터)으로 들어오면 방이 있어도 다시 연다 — 남아 있는 방이 방금 끝낸 방일 수 있다', () => {
    expect(shouldOpenCoopRoom(10, '7')).toBe(true);
  });

  it('파라미터가 빈 문자열이어도 진입 경로는 "이어서 진행"이다 — id 해석 실패는 resolveMissionId가 폴백으로 다룬다', () => {
    expect(shouldOpenCoopRoom(10, '')).toBe(true);
  });
});

/**
 * **"잠깐 쉴게요"를 눌렀는데 곧바로 미션 화면으로 되돌아오던** 되먹임의 자리.
 *
 * 실기기에서 확인된 순서는 이렇다(초대 화면 = 서버 1·2단계).
 *   1. 초대 화면은 라우트 파라미터 없이 열려 있다 — 인트로의 "시작하기", 초대 링크 참여,
 *      그리고 홈의 "이어서 진행"이 `useEnterCoopRoom`으로 갈아 끼운 둘째 진입이 모두 그렇다.
 *      방이 있고 파라미터가 없으니 이 진입에서 열 방은 없다(null).
 *   2. "잠깐 쉴게요" → `reset()` + 인트로로 `replace`. 그런데 expo-router의 imperative 전환은
 *      큐에 쌓였다가 **다음 effect에서** dispatch된다(expo-router/build/imperative-api.js의
 *      `useImperativeApiEmitter`). 그래서 `reset()`이 만든 렌더가 화면이 아직 살아 있는 채로
 *      먼저 커밋된다.
 *   3. 그 렌더에서 판단을 다시 물으면 `missionProgressId`가 null이라 **참으로 뒤집혀**
 *      폴백 미션 id로 방을 새로 연다. 그 응답이 다시 미션 화면으로 `replace`한다.
 *
 * 그래서 판단을 **진입 시점에 한 번만** 하도록 못 박는다. 화면은 지연 초기화 useState로
 * 이 함수를 한 번 부르고(app/mission/together.tsx), 여기서는 그 "한 번"을 렌더 순서로 재현한다.
 */
describe('coopRoomToOpen — 쉬기 후 되돌아오지 않는다', () => {
  const MISSION_ID = 7;

  it('진입 시점에 방이 있고 파라미터가 없으면 열지 않는다', () => {
    expect(coopRoomToOpen(COOP_ROOM_UNDECIDED, 10, undefined, MISSION_ID)).toBeNull();
  });

  it('진입 시점에 방이 없거나 "이어서 진행" 파라미터가 있으면 그 미션의 방을 연다', () => {
    expect(coopRoomToOpen(COOP_ROOM_UNDECIDED, null, undefined, MISSION_ID)).toBe(MISSION_ID);
    expect(coopRoomToOpen(COOP_ROOM_UNDECIDED, 10, '7', MISSION_ID)).toBe(MISSION_ID);
  });

  it('쉬기가 방을 비워도(reset) 판단이 뒤집히지 않는다 — 되먹임을 만들던 그 한 렌더다', () => {
    // 진입: 열 방 없음
    let decided = coopRoomToOpen(COOP_ROOM_UNDECIDED, 10, undefined, MISSION_ID);
    expect(decided).toBeNull();

    // 쉬기 직후의 렌더. 전환은 아직 dispatch되지 않아 화면이 살아 있고, 방만 비어 있다.
    decided = coopRoomToOpen(decided, null, undefined, MISSION_ID);
    expect(decided).toBeNull();

    // 그 뒤로 몇 번을 다시 물어도 마찬가지다
    expect(coopRoomToOpen(decided, null, undefined, MISSION_ID)).toBeNull();
  });

  it('열기로 정했으면 방이 채워져도 그 판단을 유지한다 — 요청은 화면의 ref가 한 번으로 묶는다', () => {
    const decided = coopRoomToOpen(COOP_ROOM_UNDECIDED, null, '7', MISSION_ID);
    expect(decided).toBe(MISSION_ID);
    expect(coopRoomToOpen(decided, 42, '7', MISSION_ID)).toBe(MISSION_ID);
  });

  it('심사위원용 모드 여부와 무관하다 — 이 판정에 들어오는 값은 방 id와 라우트 파라미터뿐이다', () => {
    const host: Participant = participant(1, 'HOST');

    for (const enabled of [false, true]) {
      // 모드가 실제로 갈렸는지 먼저 확인한다(가짜 팀원 3명). 안 갈렸다면 아래 비교가 무의미하다.
      expect(simulateParticipants([host], [], [], enabled)).toHaveLength(enabled ? 4 : 1);

      let decided = coopRoomToOpen(COOP_ROOM_UNDECIDED, 10, undefined, MISSION_ID);
      decided = coopRoomToOpen(decided, null, undefined, MISSION_ID);
      expect(decided).toBeNull();
    }
  });
});

/**
 * 역할 배정 안내가 **한 진입에 한 번만** 뜨게 하는 플래그.
 *
 * 화면 안의 ref였을 때 같은 토스트가 두 번 떴다 — 홈의 "이어서 진행"이 초대 화면을 한 진입에
 * 두 번 마운트하기 때문이다(그 경로는 `roleAssignNoticeShown` 주석에 있다).
 * 여기서는 스토어 쪽 계약만 확인한다: 한 번 표시되면 남고, 방을 떠나면(`reset`) 사라진다.
 */
describe('roleAssignNoticeShown', () => {
  beforeEach(() => {
    useCoopPartyStore.getState().reset();
  });

  it('처음에는 안 띄운 상태다', () => {
    expect(useCoopPartyStore.getState().roleAssignNoticeShown).toBe(false);
  });

  it('한 번 표시하면 남는다 — 두 번째 마운트가 같은 값을 본다', () => {
    useCoopPartyStore.getState().markRoleAssignNoticeShown();
    expect(useCoopPartyStore.getState().roleAssignNoticeShown).toBe(true);

    // 같은 값을 다시 넣지 않는다(구독 중인 화면이 공연히 다시 그려지지 않게)
    const before = useCoopPartyStore.getState();
    useCoopPartyStore.getState().markRoleAssignNoticeShown();
    expect(useCoopPartyStore.getState()).toBe(before);
  });

  it('방을 떠나면(reset) 다시 알릴 수 있다 — 다음 진입은 새 진입이다', () => {
    useCoopPartyStore.getState().markRoleAssignNoticeShown();
    useCoopPartyStore.getState().reset();
    expect(useCoopPartyStore.getState().roleAssignNoticeShown).toBe(false);
  });
});

/**
 * **협동 미션을 처음 시작하는데 거짓 안내 두 개가 함께 뜨던** 자리.
 *
 * 실기기 증상: 기본 모드에서 첫 시작인데 "방장이 퇴장하여 방장이 변경되었어요"와
 * "○○님의 참여를 거절했어요"가 떴고, 그 ○○가 **심사위원용 모드의 가짜 팀원 이름**이었다.
 *
 * 원인은 변화 감지 스냅샷이 **방을 건너 살아남은 것**이다. 인트로의 "시작하기"는 `reset()` 없이
 * 곧장 `enterRoom`으로 들어오는 유일한 경로라(useEnterCoopRoom.ts), 그때까지 스냅샷에는
 * **지난 방의 명단**이 그대로 남아 있었다. 그 명단과 새 방의 첫 응답을 비교하면 지난 방 사람들은
 * 전원이 "나갔다"로, 방장은 "바뀌었다"로 읽힌다 — 반드시 거짓 양성이 난다.
 */
describe('enterRoom — 방을 건너 스냅샷이 새지 않는다', () => {
  beforeEach(() => {
    useCoopPartyStore.getState().reset();
  });

  const OLD_HOST = 11;
  const NEW_HOST = 21;

  it('방에 들어오면 변화 감지 스냅샷을 버린다 — 지난 방과 비교할 일이 없다', () => {
    useCoopPartyStore.getState().rememberParticipants([participant(OLD_HOST, 'HOST')]);
    expect(useCoopPartyStore.getState().previousParticipants).not.toBeNull();

    useCoopPartyStore.getState().enterRoom({ missionProgressId: 99, participants: [participant(NEW_HOST, 'HOST')], myParticipantId: NEW_HOST });
    expect(useCoopPartyStore.getState().previousParticipants).toBeNull();
  });

  it('그래서 첫 응답이 거짓 승계·거짓 이탈을 만들지 않는다 — 모드 ON/OFF 모두', () => {
    for (const enabled of [false, true]) {
      useCoopPartyStore.getState().reset();

      // 지난 방의 명단. 심사위원용 모드였다면 가짜 팀원까지 들어 있다.
      const previousRoom = simulateParticipants([participant(OLD_HOST, 'HOST')], [], [], enabled);
      expect(previousRoom).toHaveLength(enabled ? 4 : 1);
      useCoopPartyStore.getState().rememberParticipants(previousRoom);

      // 새 방으로 들어온다(인트로의 "시작하기" — reset을 거치지 않는 경로)
      const newRoom = [participant(NEW_HOST, 'HOST')];
      useCoopPartyStore.getState().enterRoom({ missionProgressId: 99, participants: newRoom, myParticipantId: NEW_HOST });

      const snapshot = useCoopPartyStore.getState().previousParticipants;
      expect(becameHost(snapshot, newRoom, NEW_HOST)).toBe(false);
      expect(removedParticipants(snapshot, newRoom)).toEqual([]);
    }
  });
});

/**
 * "혼자 하고 있었는데 나갔다 들어오니 세 명이 생겼다"의 원인이 된 규칙.
 *
 * 거절 기록이 EMPTY에 있어서 "잠깐 쉴게요"의 `reset()`이 함께 지웠다. 그러면 같은 방으로 다시
 * 들어올 때 `simulateParticipants`가 "거절된 적 없는 가짜 팀원"을 다시 전원 붙인다 — 방장이
 * 이미 내린 결정이 방을 떠났다는 이유로 무효가 됐다(기기에서 확인, 심사위원용 모드).
 *
 * 방 단위로는 이어지되 방이 바뀌면 백지여야 하므로, 방 번호를 함께 들고 대조한다.
 */
describe('가짜 팀원 수락·거절의 수명', () => {
  beforeEach(() => {
    useCoopPartyStore.getState().reset();
    useCoopPartyStore.getState().forgetPausedRoom();
    useCoopPartyStore.setState({ acceptedSimulatedIds: [], rejectedSimulatedIds: [], simulatedRoomId: null });
  });

  it('쉬었다 같은 방으로 돌아와도 거절이 유지된다 — 되살아나면 혼자 하던 화면에 팀원이 생긴다', () => {
    const store = useCoopPartyStore.getState();
    store.enterRoom({ missionProgressId: 10, myParticipantId: ME, participants: SOLO });
    store.rejectSimulated(901);
    store.rejectSimulated(902);

    // "잠깐 쉴게요" → reset → 같은 방으로 이어하기
    useCoopPartyStore.getState().reset();
    useCoopPartyStore.getState().enterRoom({ missionProgressId: 10, participants: SOLO });

    expect(useCoopPartyStore.getState().rejectedSimulatedIds).toEqual([901, 902]);
  });

  it('다른 방으로 들어가면 결정을 버린다 — 새 방의 초대는 다시 받는 것이 맞다', () => {
    const store = useCoopPartyStore.getState();
    store.enterRoom({ missionProgressId: 10, myParticipantId: ME, participants: SOLO });
    store.rejectSimulated(901);
    store.acceptSimulated(902);

    useCoopPartyStore.getState().enterRoom({ missionProgressId: 11, participants: SOLO });

    expect(useCoopPartyStore.getState().rejectedSimulatedIds).toEqual([]);
    expect(useCoopPartyStore.getState().acceptedSimulatedIds).toEqual([]);
  });

  it('거절이 유지되면 그 팀원은 목록에 다시 붙지 않는다', () => {
    const store = useCoopPartyStore.getState();
    store.enterRoom({ missionProgressId: 10, myParticipantId: ME, participants: SOLO });
    const [firstSim] = simulateParticipants(SOLO, [], [], true).filter((p) => p.participantId !== ME);
    store.rejectSimulated(firstSim.participantId);

    useCoopPartyStore.getState().reset();
    useCoopPartyStore.getState().enterRoom({ missionProgressId: 10, participants: SOLO });

    const { rejectedSimulatedIds, acceptedSimulatedIds } = useCoopPartyStore.getState();
    const shown = simulateParticipants(SOLO, acceptedSimulatedIds, rejectedSimulatedIds, true);
    expect(shown.some((p) => p.participantId === firstSim.participantId)).toBe(false);
  });

  // 빈 목록이 매번 새 배열이면 이 값을 구독하는 화면이 방에 들어올 때마다 다시 그려진다
  it('결정이 없을 때는 같은 빈 배열 참조를 돌려준다', () => {
    const store = useCoopPartyStore.getState();
    store.enterRoom({ missionProgressId: 10, participants: SOLO });
    const first = useCoopPartyStore.getState().rejectedSimulatedIds;
    useCoopPartyStore.getState().enterRoom({ missionProgressId: 11, participants: SOLO });

    expect(useCoopPartyStore.getState().rejectedSimulatedIds).toBe(first);
  });
});
