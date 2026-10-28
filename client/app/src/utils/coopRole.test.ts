import type { RoleCard, RoleProgress } from '@packages/shared';
import { describe, expect, it } from 'vitest';
import * as coopRoleModule from './coopRole';
import { DEV_SIM_PARTICIPANT_IDS, realParticipants } from './coopDevSimulation';
import {
  allRolesVerified,
  canCompleteCoopMission,
  findRoleCard,
  isRoleVerified,
  myRoleProgress,
  myRoleView,
  otherRoleProgresses,
  remainingRoleAssignTargets,
  roleChips,
  takenRoleCardIds,
  verifiedRoleCount,
} from './coopRole';

function progress(participantId: number, overrides: Partial<RoleProgress> = {}): RoleProgress {
  return {
    roleProgressId: participantId * 10,
    participantId,
    participantName: `참여자${participantId}`,
    roleCardId: participantId,
    roleName: '물지기',
    progressStatus: 'IN_PROGRESS',
    itemImgUrl: null,
    ...overrides,
  };
}

function card(roleCardId: number, roleName = '물지기'): RoleCard {
  return {
    roleCardId,
    roleName,
    roleDescription: '설명',
    locationToFind: ['용천수', '물길'],
  };
}

describe('roleChips', () => {
  it('서버가 준 배열을 그대로 알약으로 쓴다', () => {
    expect(roleChips(['용천수', '물길', '연못', '젖은 돌 주변'])).toEqual(['용천수', '물길', '연못', '젖은 돌 주변']);
  });

  it('앞뒤 공백을 지운다', () => {
    expect(roleChips([' 용천수', '물길 ', ' 연못 '])).toEqual(['용천수', '물길', '연못']);
  });

  it('빈 조각을 버린다 — 빈 알약이 그려지면 안 된다', () => {
    expect(roleChips(['용천수', '', '물길', '   '])).toEqual(['용천수', '물길']);
  });

  it('빈 배열이면 칩이 없다 — 섹션 자체를 그리지 않는 조건이 된다', () => {
    expect(roleChips([])).toEqual([]);
  });
});

describe('findRoleCard', () => {
  it('id로 찾는다', () => {
    const target = card(2, '땅지기');
    expect(findRoleCard([card(1), target], 2)).toBe(target);
  });

  it('없으면 null — 서버가 진행도만 주고 카드를 빼먹은 응답을 방어한다', () => {
    expect(findRoleCard([card(1)], 99)).toBeNull();
  });
});

describe('roleSelectionItems', () => {
  it('marks the selected role without changing the original card order', () => {
    const roleSelectionItems = (
      coopRoleModule as typeof coopRoleModule & {
        roleSelectionItems?: (roleCards: RoleCard[], selectedRoleCardId: number | null) => { card: RoleCard; selected: boolean }[];
      }
    ).roleSelectionItems;

    expect(roleSelectionItems).toBeTypeOf('function');
    if (roleSelectionItems === undefined) return;

    const cards = [card(1, '물지기'), card(2, '바람지기'), card(3, '빛지기')];
    const items = roleSelectionItems(cards, 2);

    expect(items.map(({ card: item }) => item.roleCardId)).toEqual([1, 2, 3]);
    expect(items.map(({ selected }) => selected)).toEqual([false, true, false]);
  });
});

describe('toggleExpandedRoleCardId', () => {
  it('opens a collapsed role and closes the same role when pressed again', () => {
    const toggleExpandedRoleCardId = (
      coopRoleModule as typeof coopRoleModule & {
        toggleExpandedRoleCardId?: (currentRoleCardId: number | null, targetRoleCardId: number) => number | null;
      }
    ).toggleExpandedRoleCardId;

    expect(toggleExpandedRoleCardId).toBeTypeOf('function');
    if (toggleExpandedRoleCardId === undefined) return;

    expect(toggleExpandedRoleCardId(null, 2)).toBe(2);
    expect(toggleExpandedRoleCardId(2, 2)).toBeNull();
    expect(toggleExpandedRoleCardId(2, 3)).toBe(3);
  });
});

describe('myRoleProgress', () => {
  it('내 participantId의 진행도를 돌려준다', () => {
    const mine = progress(2);
    expect(myRoleProgress([progress(1), mine], 2)).toBe(mine);
  });

  it('아직 역할을 고르지 않았으면 null', () => {
    expect(myRoleProgress([progress(1)], 2)).toBeNull();
  });

  it('내 id를 모르면(방 응답 전) null', () => {
    expect(myRoleProgress([progress(1)], null)).toBeNull();
  });
});

/**
 * "나의 역할" 자리에 스켈레톤을 그릴지, 문구를 그릴지, 카드를 그릴지.
 *
 * 로딩과 "배정되지 않음"을 가르지 못하면 기다리면 채워질 자리에 "배정되지 않았어요"가 떠서
 * 없는 문제를 알리게 된다. 반대로 둘을 합치면 영영 오지 않을 값에 스켈레톤이 계속 반짝인다.
 */
describe('myRoleView', () => {
  it('내 신원을 아직 모르면 로딩이다 — 폴링의 currentParticipant가 오기 전이다', () => {
    expect(myRoleView([progress(1)], [card(1)], null)).toBe('loading');
  });

  it('역할 목록이 비어 있으면 로딩이다 — 배정 결과가 아직 도착하지 않았다', () => {
    expect(myRoleView([], [card(1)], 1)).toBe('loading');
  });

  it('진행도는 있는데 그 역할 카드가 아직 없으면 로딩이다 — 이름·설명이 전부 카드에서 나온다', () => {
    expect(myRoleView([progress(1)], [], 1)).toBe('loading');
  });

  it('남의 배정은 있는데 내 것만 없으면 미배정이다 — 기다려도 바뀌지 않으므로 문구로 말한다', () => {
    expect(myRoleView([progress(1), progress(2)], [card(1), card(2)], 3)).toBe('missing');
  });

  it('내 역할과 그 카드를 모두 알면 카드를 그린다', () => {
    expect(myRoleView([progress(1), progress(2)], [card(1), card(2)], 2)).toBe('ready');
  });
});

describe('otherRoleProgresses', () => {
  it('나를 뺀 나머지', () => {
    expect(otherRoleProgresses([progress(1), progress(2), progress(3)], 2).map((p) => p.participantId)).toEqual([1, 3]);
  });

  it('내 id를 모르면 전부 남는다', () => {
    expect(otherRoleProgresses([progress(1)], null)).toHaveLength(1);
  });
});

describe('takenRoleCardIds', () => {
  it('배정된 역할 id를 모은다', () => {
    expect(takenRoleCardIds([progress(1, { roleCardId: 3 }), progress(2, { roleCardId: 5 })])).toEqual([3, 5]);
  });
});

describe('isRoleVerified / verifiedRoleCount', () => {
  it('COMPLETED만 인증으로 본다', () => {
    expect(isRoleVerified(progress(1, { progressStatus: 'COMPLETED' }))).toBe(true);
    expect(isRoleVerified(progress(1))).toBe(false);
  });

  it('인증 수를 센다', () => {
    expect(verifiedRoleCount([progress(1, { progressStatus: 'COMPLETED' }), progress(2)])).toBe(1);
  });
});

describe('allRolesVerified', () => {
  it('전원 COMPLETED면 참', () => {
    expect(allRolesVerified([progress(1, { progressStatus: 'COMPLETED' }), progress(2, { progressStatus: 'COMPLETED' })])).toBe(true);
  });

  it('한 명이라도 남으면 거짓', () => {
    expect(allRolesVerified([progress(1, { progressStatus: 'COMPLETED' }), progress(2)])).toBe(false);
  });

  it('빈 목록은 거짓 — 배정 전 상태를 전원 완료로 보면 안 된다', () => {
    // `every`는 빈 배열에서 참이다. 그 함정을 함수가 길이로 먼저 막는지 못 박아 둔다
    expect(allRolesVerified([])).toBe(false);
  });
});

describe('canCompleteCoopMission', () => {
  const done = (participantId: number) => progress(participantId, { progressStatus: 'COMPLETED' });

  it('전원 인증 완료면 방장이 아니어도 활성 — step3의 "다음"은 팀원 누구든 누를 수 있다', () => {
    // 2번은 방장이 아니지만(이 함수는 역할만 본다) 전원이 끝났으므로 완료로 올릴 수 있다
    expect(canCompleteCoopMission([done(1), done(2), done(3)], 2)).toBe(true);
  });

  it('한 명이라도 인증이 남으면 비활성', () => {
    expect(canCompleteCoopMission([done(1), progress(2), done(3)], 1)).toBe(false);
  });

  it('내가 아직 인증하지 않았으면 비활성', () => {
    expect(canCompleteCoopMission([progress(1), done(2)], 1)).toBe(false);
  });

  it('내 신원을 모르면 비활성 — 첫 폴링의 currentParticipant가 오기 전 구간', () => {
    expect(canCompleteCoopMission([done(1), done(2)], null)).toBe(false);
  });

  /**
   * 심사위원용 모드의 그 상태다. 가짜 팀원의 진행도는 언제나 COMPLETED라
   * `allRolesVerified`만 보면 참이 된다 — "나의 역할"은 비어 있는데 "다음"이 열렸다.
   */
  it('내 역할이 목록에 없으면 남들이 전원 완료여도 비활성', () => {
    expect(canCompleteCoopMission([done(-101), done(-102), done(-103)], 7)).toBe(false);
  });

  it('빈 목록은 비활성 — 역할 배정 전에 완료 화면으로 넘어가면 안 된다', () => {
    expect(canCompleteCoopMission([], 1)).toBe(false);
    expect(canCompleteCoopMission([], null)).toBe(false);
  });
});

/**
 * **끊긴 배정을 되살릴 때 기존 배정을 덮어쓰지 않는지.**
 *
 * 방이 2단계에 굳었다는 것은 `PATCH progress(2)`는 성공했고 그 뒤 참여자별 `PUT`이나
 * 마지막 `PATCH progress(3)`에서 끊겼다는 뜻이다 — 즉 **역할이 일부만 저장돼 있을 수 있다.**
 * 그냥 다시 섞으면 이미 A카드에 저장된 사람이 B카드로 옮겨 가는데, `PUT`이 카드 단위라
 * A카드의 옛 행이 남아 한 사람이 두 역할을 갖는다.
 */
describe('remainingRoleAssignTargets', () => {
  const CARDS = [card(1, '물지기'), card(2, '땅지기'), card(3, '빛지기')];
  const PARTICIPANTS = [{ participantId: 10 }, { participantId: 11 }, { participantId: 12 }];

  it('아무것도 저장돼 있지 않으면 전원·전 카드가 대상이다 — 첫 배정과 같다', () => {
    const remaining = remainingRoleAssignTargets(PARTICIPANTS, CARDS, []);
    expect(remaining.participants).toHaveLength(3);
    expect(remaining.roleCards).toHaveLength(3);
  });

  it('이미 배정된 사람과 그 카드는 대상에서 빠진다 — 재시도가 옮기면 두 역할이 된다', () => {
    const saved = [progress(10, { roleCardId: 2 })];
    const remaining = remainingRoleAssignTargets(PARTICIPANTS, CARDS, saved);

    expect(remaining.participants.map((p) => p.participantId)).toEqual([11, 12]);
    expect(remaining.roleCards.map((card) => card.roleCardId)).toEqual([1, 3]);
  });

  it('전원이 이미 배정돼 있으면 남는 것이 없다 — 그때 남은 일은 단계를 올리는 것뿐이다', () => {
    const saved = [progress(10, { roleCardId: 1 }), progress(11, { roleCardId: 2 }), progress(12, { roleCardId: 3 })];
    const remaining = remainingRoleAssignTargets(PARTICIPANTS, CARDS, saved);

    expect(remaining.participants).toEqual([]);
    expect(remaining.roleCards).toEqual([]);
  });

  it('심사위원용 모드의 가짜 진행도는 호출부가 걸러서 넘긴다 — 걸러지면 카드가 줄지 않는다', () => {
    const [SIM] = DEV_SIM_PARTICIPANT_IDS;
    // 가짜는 남는 카드(3번)를 골라 붙는다. 그것을 "쓰인 카드"로 세면 진짜 참여자 몫이 줄어든다.
    const savedWithSim = [progress(10, { roleCardId: 1 }), progress(SIM, { roleCardId: 3 })];

    const wrong = remainingRoleAssignTargets(PARTICIPANTS, CARDS, savedWithSim);
    expect(wrong.roleCards.map((card) => card.roleCardId)).toEqual([2]);

    const right = remainingRoleAssignTargets(PARTICIPANTS, CARDS, realParticipants(savedWithSim));
    expect(right.roleCards.map((card) => card.roleCardId)).toEqual([2, 3]);
  });
});
