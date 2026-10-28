import type { Participant } from '@packages/shared';
import { describe, expect, it } from 'vitest';
import { DEV_SIM_PARTICIPANT_IDS, simulateParticipants } from './coopDevSimulation';
import {
  activeParticipants,
  allParticipantsReady,
  becameHost,
  canInviteMore,
  canReviewJoinRequest,
  canStartCoopMission,
  coopStartBlock,
  findHost,
  isHost,
  isParticipantReady,
  pendingParticipants,
  removedParticipants,
  shouldSkipPartyChangeCheck,
  soleParticipantId,
  wasRemoved,
} from './party';

/**
 * 계약이 바뀐 뒤의 픽스처.
 *
 * 예전에는 `isHost` 불리언과 `participantStatus: 'ACCEPTED' | 'LEFT'`였다. 지금 서버는
 * `participantRole: 'HOST' | 'MEMBER'`와 `participantStatus: 'PENDING' | 'ACCEPTED'`를 준다 —
 * 즉 **수락 대기가 서버 상태가 됐고, 이탈은 상태가 아니라 목록에서 사라지는 것**이 됐다
 * (거절은 `DELETE .../participants/{id}`다).
 */
function member(participantId: number, overrides: Partial<Participant> = {}): Participant {
  return {
    participantId,
    name: `참여자${participantId}`,
    participantRole: 'MEMBER',
    participantStatus: 'ACCEPTED',
    ...overrides,
  };
}

const host = (participantId: number, overrides: Partial<Participant> = {}) => member(participantId, { participantRole: 'HOST', ...overrides });
const pending = (participantId: number) => member(participantId, { participantStatus: 'PENDING' });

describe('findHost', () => {
  it('빈 목록이면 방장이 없다', () => {
    expect(findHost([])).toBeNull();
  });

  it('participantRole이 HOST인 참여자를 돌려준다', () => {
    const theHost = host(2);
    expect(findHost([member(1), theHost, member(3)])).toBe(theHost);
  });

  it('방장이 없으면 null', () => {
    expect(findHost([member(1), member(2)])).toBeNull();
  });

  it('수락 대기 중인 사람은 방장으로 보지 않는다', () => {
    expect(findHost([host(1, { participantStatus: 'PENDING' })])).toBeNull();
  });
});

describe('isHost', () => {
  it('내 id가 방장 id와 같으면 참', () => {
    expect(isHost([host(1), member(2)], 1)).toBe(true);
  });

  it('내 id가 방장이 아니면 거짓', () => {
    expect(isHost([host(1), member(2)], 2)).toBe(false);
  });

  it('내 id를 아직 모르면 거짓', () => {
    // 방 생성 응답을 받기 전에는 방장 전용 버튼이 보이면 안 된다
    expect(isHost([host(1)], null)).toBe(false);
  });
});

describe('activeParticipants', () => {
  it('수락 대기 중인 사람을 정원에서 뺀다', () => {
    const result = activeParticipants([member(1), pending(2), member(3)]);
    expect(result.map((p) => p.participantId)).toEqual([1, 3]);
  });
});

describe('canInviteMore', () => {
  it('정원(6명)에 도달하면 거짓', () => {
    const full = [1, 2, 3, 4, 5, 6].map((id) => member(id));
    expect(canInviteMore(full)).toBe(false);
  });

  it('정원보다 적으면 참', () => {
    expect(canInviteMore([1, 2, 3, 4, 5].map((id) => member(id)))).toBe(true);
  });

  it('수락 대기 중인 사람은 정원에 세지 않는다', () => {
    const members = [...[1, 2, 3, 4, 5].map((id) => member(id)), ...[6, 7, 8].map((id) => pending(id))];
    expect(canInviteMore(members)).toBe(true);
  });
});

describe('becameHost', () => {
  const notHost = [host(1), member(2)];
  // 방장이 나가면 목록에서 사라지고 서버가 다른 사람을 HOST로 올린다
  const nowHost = [host(2)];

  it('첫 폴링은 변화가 아니다', () => {
    // 방에 들어온 순간 "방장이 되었어요"가 뜨면 안 된다
    expect(becameHost(null, [host(2)], 2)).toBe(false);
  });

  it('같은 응답이 반복되면 거짓', () => {
    // 폴링은 같은 값을 계속 주므로 매 주기마다 토스트가 뜨면 안 된다
    expect(becameHost(notHost, notHost, 2)).toBe(false);
  });

  it('내가 방장이 아니었다가 방장이 되면 참', () => {
    expect(becameHost(notHost, nowHost, 2)).toBe(true);
  });

  it('계속 방장이면 거짓', () => {
    expect(becameHost(notHost, notHost, 1)).toBe(false);
  });

  it('남이 방장이 되면 거짓', () => {
    expect(becameHost(notHost, nowHost, 1)).toBe(false);
  });

  it('내 id를 모르면 거짓', () => {
    expect(becameHost(notHost, nowHost, null)).toBe(false);
  });

  /**
   * 실기기에서 나온 거짓 안내("혼자 하는 미션인데 방장이 바뀌었다고 뜬다")를 고정한다.
   *
   * 옛 규칙(`!isHost(prev, me) && isHost(next, me)`)은 **방장을 모르던 상태**를
   * "내가 방장이 아니었다"로 읽었다. 홈의 "이어서 진행"으로 초대 화면에 들어오면 화면이
   * 스스로 `reset()`을 부르고 그 사이의 빈 목록이 스냅샷으로 남는데, 이어하기 응답이 도착해
   * 방장(=나)이 나타나는 순간 그 규칙이 참이 됐다.
   */
  it('이전 목록이 비어 있으면 거짓 — 방을 여는 중의 빈 스냅샷은 "방장이 아니었다"가 아니다', () => {
    expect(becameHost([], [host(2)], 2)).toBe(false);
  });

  it('이전 목록에 방장이 없으면 거짓 — 심사위원용 모드의 가짜 팀원은 전원 MEMBER라 이 목록이 만들어진다', () => {
    // 시뮬레이션은 참여자를 덧붙이기만 하고 방장 역할은 만들지 않는다(coopDevSimulation.ts).
    // 방을 여는 중에는 진짜 방장이 아직 없어 목록이 MEMBER뿐이 된다.
    const simulatedOnly = [member(-101), member(-102), member(-103)];
    expect(becameHost(simulatedOnly, [host(2), ...simulatedOnly], 2)).toBe(false);
  });

  it('가짜 팀원이 섞여 있어도 방장 신원만 본다 — 목록이 부풀어도 판정이 흔들리지 않는다', () => {
    const sims = [member(-101), member(-102)];
    expect(becameHost([host(1), member(2), ...sims], [host(2), ...sims], 2)).toBe(true);
    expect(becameHost([host(1), member(2), ...sims], [host(1), member(2), ...sims], 2)).toBe(false);
  });

  it('다음 목록에 방장이 없으면 거짓 — 4단계 응답은 참여자를 주지 않는다', () => {
    expect(becameHost(notHost, [], 2)).toBe(false);
  });
});

/**
 * 방 생성·이어하기 응답에는 `currentParticipant`가 없다. 그래서 "나"를 단정할 수 있는 경우는
 * 참여자가 한 명뿐일 때뿐이다 — 예전에는 방장을 곧 나라고 봤고, 그 추측이
 * 멤버의 이어하기 진입과 승계 판정을 함께 망가뜨렸다.
 */
describe('soleParticipantId', () => {
  it('참여자가 한 명이면 그 사람이 나다 — 새로 만든 방', () => {
    expect(soleParticipantId([host(7)])).toBe(7);
  });

  it('여럿이면 알 수 없다 — 방장을 나라고 단정하지 않는다', () => {
    expect(soleParticipantId([host(1), member(2)])).toBeNull();
  });

  it('빈 목록이면 알 수 없다', () => {
    expect(soleParticipantId([])).toBeNull();
  });

  it('한 명이면 역할이 무엇이든 나다 — 멤버 혼자 남은 방도 있다', () => {
    expect(soleParticipantId([member(5)])).toBe(5);
  });
});

describe('isParticipantReady', () => {
  it('ACCEPTED면 준비 완료다', () => {
    expect(isParticipantReady(member(2))).toBe(true);
  });

  it('PENDING이면 준비 완료가 아니다', () => {
    expect(isParticipantReady(pending(2))).toBe(false);
  });

  it('방장도 상태로만 판단한다 — 역할이 준비 여부를 대신하지 않는다', () => {
    expect(isParticipantReady(host(1))).toBe(true);
  });
});

describe('pendingParticipants', () => {
  it('PENDING인 참여자만 돌려준다', () => {
    const participants = [host(1), member(2), pending(3)];
    expect(pendingParticipants(participants).map((p) => p.participantId)).toEqual([3]);
  });

  it('대기자가 없으면 빈 배열', () => {
    expect(pendingParticipants([host(1), member(2)])).toEqual([]);
  });
});

describe('allParticipantsReady', () => {
  it('대기자가 없으면 참', () => {
    expect(allParticipantsReady([host(1), member(2)])).toBe(true);
  });

  it('대기자가 하나라도 있으면 거짓', () => {
    expect(allParticipantsReady([host(1), pending(2)])).toBe(false);
  });

  it('방장 혼자면 참 — 참여 멤버는 1명부터 시작할 수 있다', () => {
    expect(allParticipantsReady([host(1)])).toBe(true);
  });

  it('빈 목록은 거짓 — 응답이 비어 온 순간 다음 단계로 넘어가면 원인을 찾기 어렵다', () => {
    expect(allParticipantsReady([])).toBe(false);
  });
});

describe('canStartCoopMission', () => {
  it('방장이면 활성 — step1의 "다음"은 방장만 누른다', () => {
    expect(canStartCoopMission([host(1), member(2)], 1)).toBe(true);
  });

  it('멤버면 비활성 — 팀원도 누를 수 있으면 역할 랜덤 배정이 두 번 실행돼 서로 덮어써진다', () => {
    expect(canStartCoopMission([host(1), member(2)], 2)).toBe(false);
  });

  it('내 신원을 모르면 비활성 — 첫 폴링 전에는 내가 방장인지 말할 수 없다', () => {
    expect(canStartCoopMission([host(1), member(2)], null)).toBe(false);
  });

  it('방장 혼자여도 활성 — 최소 인원은 1명이다', () => {
    expect(canStartCoopMission([host(1)], 1)).toBe(true);
  });

  it('수락 대기자가 남아 있으면 비활성 — 넘어가면 수락 여부를 확인할 화면이 없다', () => {
    expect(canStartCoopMission([host(1), pending(2)], 1)).toBe(false);
  });

  it('빈 목록은 비활성', () => {
    expect(canStartCoopMission([], 1)).toBe(false);
  });

  /**
   * 심사위원용 모드의 가짜 팀원은 전원 MEMBER라(coopDevSimulation.ts) 방장 판정을 흔들지 않는다.
   * 수락 전에는 대기자로 남아 "다음"을 막고, 방장이 수락하면 열린다 — 인원 자동 추가는 의도된 동작이다.
   */
  it('가짜 팀원이 붙어도 방장 판정은 그대로이고, 수락 전에는 대기자로 막힌다', () => {
    const simPending = [host(1), member(-101, { participantStatus: 'PENDING' })];
    expect(canStartCoopMission(simPending, 1)).toBe(false);

    const simAccepted = [host(1), member(-101)];
    expect(canStartCoopMission(simAccepted, 1)).toBe(true);
  });
});

/**
 * 네 번째 인자는 **`reviewOpen`**(= 지금이 이 조작을 열어도 되는 구간인가)이다.
 * 예전 인자 `assigningRoles`와 **뜻이 뒤집혔다** — 그 값은 화면이 `coopInviteActionsOpen`에서
 * 받아 "다음"과 **같이** 넘긴다(coopStep.ts). 한쪽만 열린 화면을 만들지 않기 위해서다.
 */
describe('canReviewJoinRequest', () => {
  const room = [host(1), pending(2), member(3)];

  it('구간이 열려 있으면 방장에게 대기자의 수락·거절이 보인다', () => {
    expect(canReviewJoinRequest(pending(2), room, 1, true)).toBe(true);
  });

  it('이미 수락된 사람에게는 보이지 않는다 — 되돌릴 동작이 아니다', () => {
    expect(canReviewJoinRequest(member(3), room, 1, true)).toBe(false);
  });

  it('내 카드에는 보이지 않는다 — 방장이 자기를 수락하지 않는다', () => {
    expect(canReviewJoinRequest(host(1), room, 1, true)).toBe(false);
  });

  it('멤버에게는 어느 구간에서도 보이지 않는다 — 수락·거절은 방장의 권한이다', () => {
    expect(canReviewJoinRequest(pending(2), room, 3, true)).toBe(false);
    expect(canReviewJoinRequest(pending(2), room, 3, false)).toBe(false);
  });

  it('내 신원을 모르면 보이지 않는다 — 첫 폴링 전에는 내가 방장인지 말할 수 없다', () => {
    expect(canReviewJoinRequest(pending(2), room, null, true)).toBe(false);
  });

  /**
   * 사용자 지시: 배정이 도는 동안 화면에는 준비 완료된 사람만 있어야 한다.
   * 재시도는 대기자가 없을 때만 눌리지만, 초대 링크는 살아 있어서 그 뒤에 들어온 사람이 생긴다 —
   * 그 사람을 지금 수락해 봐야 역할은 누른 시점의 명단으로 이미 나뉘었다.
   */
  it('구간이 닫혀 있으면 방장에게도 보이지 않는다 — 배정 중과 단계를 모르는 동안이 그렇다', () => {
    expect(canReviewJoinRequest(pending(2), room, 1, false)).toBe(false);
  });
});

describe('wasRemoved', () => {
  const me = 2;

  it('첫 응답은 변화로 보지 않는다 — 진입 순간 거절 안내가 뜨면 안 된다', () => {
    expect(wasRemoved(null, [host(1)], me)).toBe(false);
  });

  it('목록에서 사라지면 참 — 거절은 서버가 참여자를 지운다', () => {
    expect(wasRemoved([host(1), member(me)], [host(1)], me)).toBe(true);
  });

  it('수락 대기 중이던 내가 거절당한 경우도 참', () => {
    expect(wasRemoved([host(1), pending(me)], [host(1)], me)).toBe(true);
  });

  it('그대로 남아 있으면 거짓', () => {
    const list = [host(1), member(me)];
    expect(wasRemoved(list, list, me)).toBe(false);
  });

  it('PENDING에서 ACCEPTED로 바뀐 것은 이탈이 아니다', () => {
    expect(wasRemoved([host(1), pending(me)], [host(1), member(me)], me)).toBe(false);
  });

  it('남이 빠진 것은 내 이탈이 아니다', () => {
    expect(wasRemoved([host(1), member(me), member(3)], [host(1), member(me)], me)).toBe(false);
  });

  it('내 id를 모르면 거짓', () => {
    expect(wasRemoved([member(1)], [], null)).toBe(false);
  });
});

describe('removedParticipants', () => {
  it('첫 응답은 빈 배열', () => {
    expect(removedParticipants(null, [member(1)])).toEqual([]);
  });

  it('목록에서 사라진 참여자를 돌려준다', () => {
    const prev = [host(1), member(2), member(3)];
    const next = [host(1), member(3)];
    expect(removedParticipants(prev, next).map((p) => p.participantId)).toEqual([2]);
  });

  it('거절당한 대기자도 포함한다', () => {
    expect(removedParticipants([host(1), pending(2)], [host(1)]).map((p) => p.participantId)).toEqual([2]);
  });

  it('새로 들어온 참여자는 세지 않는다', () => {
    expect(removedParticipants([member(1)], [member(1), member(2)])).toEqual([]);
  });

  it('이미 빠진 참여자는 다시 알리지 않는다 — 폴링마다 토스트가 뜨면 안 된다', () => {
    const list = [host(1)];
    expect(removedParticipants(list, list)).toEqual([]);
  });
});

/**
 * **끊긴 배정을 되살릴 때도 규칙은 같다** — 서버 2단계에서의 "다음"(= "다시 역할 나누기").
 *
 * 한동안 이 함수에는 `assigningRoles` 인자가 있어서, 배정 구간에서는 수락 대기자 조건을
 * **건너뛰었다.** 2단계에 굳은 방에서 재시도가 영영 열리지 않는 것을 풀려던 완화인데,
 * 사용자가 확정한 규칙이 그 반대다:
 *
 * > "step2에서 재시도를 하면 그 사이에 다른 사람이 초대되어 들어왔더라도 모두 '준비 완료'가
 * >  아니면 '재시도'가 되면 안 돼. 왜냐면 '준비 완료'가 되었을 때만 step2로 넘어갈 수 있으니까"
 *
 * 그래서 인자가 사라졌다. 교착은 조건을 풀어서가 아니라 **수락·거절을 그 구간에 열어서** 푼다
 * (coopStep.ts의 `coopInviteActionsOpen`) — 방장이 대기자를 처리하면 조건이 저절로 참이 된다.
 */
describe('coopStartBlock / canStartCoopMission — 끊긴 2단계의 재시도', () => {
  it('2단계 고착 + 전원 준비 완료 → 방장에게 재시도가 열린다', () => {
    const participants = [host(1), member(2)];
    expect(coopStartBlock(participants, 1)).toBe('none');
    expect(canStartCoopMission(participants, 1)).toBe(true);
  });

  it('2단계 고착 + 대기자 있음 → 재시도가 막히고, 막은 이유가 대기자로 나온다', () => {
    const participants = [host(1), member(2), pending(3)];
    expect(coopStartBlock(participants, 1)).toBe('pending');
    expect(canStartCoopMission(participants, 1)).toBe(false);
  });

  it('그 대기자를 수락하면 곧바로 열린다 — 막힌 상태가 막다른 길이 아니다', () => {
    const blocked = [host(1), pending(2)];
    expect(canStartCoopMission(blocked, 1)).toBe(false);

    // 방장이 수락(서버가 ACCEPTED로 바꿔 폴링이 실어 온다) 또는 거절(목록에서 사라진다)
    expect(canStartCoopMission([host(1), member(2)], 1)).toBe(true);
    expect(canStartCoopMission([host(1)], 1)).toBe(true);
  });

  it('멤버에게는 어느 경우에도 재시도가 없다 — 두 번 돌면 배정이 서로 덮어써진다', () => {
    expect(coopStartBlock([host(1), member(2)], 2)).toBe('not-host');
    expect(canStartCoopMission([host(1), member(2)], 2)).toBe(false);
    expect(canStartCoopMission([host(1), member(2), pending(3)], 2)).toBe(false);
    // 내 신원을 아직 모르는 구간도 같다
    expect(canStartCoopMission([host(1), member(2)], null)).toBe(false);
  });

  /**
   * **심사위원용 모드의 가짜 팀원이 재시도를 영영 막지 않는다.**
   *
   * 2·3단계 응답에는 가짜가 **전원 ACCEPTED**로 붙는다(coopDevSimulation.ts — 그 단계까지 왔다는
   * 것은 이미 다 수락했다는 뜻이라 수락 목록을 보지 않는다). 그래서 끊긴 2단계에서 대기자로
   * 남아 새 규칙을 영구히 거짓으로 만드는 일이 없다. 1단계에서만 대기자로 붙는데 그때는 재시도
   * 자체가 없고, 방장이 수락하면 빠진다.
   */
  it('모드 ON/OFF — 가짜 팀원은 2단계에서 전원 수락 상태라 재시도를 막지 않는다', () => {
    for (const enabled of [false, true]) {
      const assigningRoom = simulateParticipants([host(1)], DEV_SIM_PARTICIPANT_IDS as number[], [], enabled);
      expect(assigningRoom).toHaveLength(enabled ? 4 : 1);
      expect(coopStartBlock(assigningRoom, 1)).toBe('none');
      expect(canStartCoopMission(assigningRoom, 1)).toBe(true);
      // 방장이 아니면 모드와 무관하게 막힌다
      expect(canStartCoopMission(assigningRoom, 999)).toBe(false);

      // 1단계 목록(수락 전)에서는 가짜가 대기자다 — 모드가 켜졌을 때만 막힌다
      const invitingRoom = simulateParticipants([host(1)], [], [], enabled);
      expect(coopStartBlock(invitingRoom, 1)).toBe(enabled ? 'pending' : 'none');
    }
  });
});

/**
 * **모드를 토글해도 없던 이탈·승계를 알리지 않는다.**
 *
 * 실기기에서 기본 모드로 협동 미션을 처음 시작하는데 "○○님의 참여를 거절했어요"가 심사위원용
 * 모드의 **가짜 이름**으로 떴다. 목록에 가짜가 섞인 채 스냅샷이 잡혀 있었고, 모드를 끄면서
 * 그 세 명이 한꺼번에 사라진 것을 "나갔다"로 읽은 것이다.
 */
describe('shouldSkipPartyChangeCheck', () => {
  const withoutFakes = [host(1)];
  const withFakes = simulateParticipants(withoutFakes, DEV_SIM_PARTICIPANT_IDS as number[], [], true);

  it('모드가 꺼지는 순간 목록에서 세 명이 사라진다 — 그대로 비교하면 거짓 이탈 세 건이다', () => {
    // 왜 건너뛰어야 하는지의 증거. 이 비교가 그대로 돌면 토스트가 세 번 뜬다.
    expect(removedParticipants(withFakes, withoutFakes)).toHaveLength(3);
  });

  it('모드가 바뀐 회차는 건너뛴다 — 그 회차는 폴링 사이의 사건이 아니다', () => {
    expect(shouldSkipPartyChangeCheck(true, false)).toBe(true);
    expect(shouldSkipPartyChangeCheck(false, true)).toBe(true);
  });

  it('모드가 그대로면 평소처럼 비교한다 — 진짜 이탈까지 놓치면 안 된다', () => {
    expect(shouldSkipPartyChangeCheck(false, false)).toBe(false);
    expect(shouldSkipPartyChangeCheck(true, true)).toBe(false);
  });

  it('건너뛴 회차가 스냅샷을 갈아 끼우면 다음 회차부터는 조용하다', () => {
    // 건너뛴 회차: 스냅샷을 새 기준(가짜 없는 목록)으로 다시 잡는다
    const snapshotAfterSkip = withoutFakes;
    // 다음 회차: 같은 기준끼리 비교하므로 알릴 것이 없다
    expect(removedParticipants(snapshotAfterSkip, withoutFakes)).toEqual([]);
    expect(becameHost(snapshotAfterSkip, withoutFakes, 1)).toBe(false);
  });
});
