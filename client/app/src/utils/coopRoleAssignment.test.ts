import type { Participant, RoleCard } from '@packages/shared';
import { describe, expect, it } from 'vitest';
import { randomRoleAssignments } from './coopRoleAssignment';

function participant(participantId: number, overrides: Partial<Participant> = {}): Participant {
  return {
    participantId,
    name: `참여자${participantId}`,
    participantRole: 'MEMBER',
    participantStatus: 'ACCEPTED',
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

/** 항상 0을 주는 random. Fisher–Yates가 매 회전마다 0번 원소와 바꾸므로 결과가 한 칸 왼쪽 회전이 된다 */
const alwaysZero = () => 0;

function participants(count: number): Participant[] {
  return Array.from({ length: count }, (_, index) => participant(index + 1));
}

function cards(count: number): RoleCard[] {
  return Array.from({ length: count }, (_, index) => card(index + 1));
}

describe('randomRoleAssignments', () => {
  it('PENDING 참여자는 배정에서 빠진다 — 방장이 아직 수락하지 않은 사람에게 역할을 주면 안 된다', () => {
    const list = [participant(1, { participantRole: 'HOST' }), participant(2, { participantStatus: 'PENDING' }), participant(3)];

    const result = randomRoleAssignments(list, cards(3), alwaysZero);

    expect(result.map((assignment) => assignment.participantId)).toEqual([1, 3]);
  });

  it('6명 6카드면 모두가 서로 다른 역할을 받는다', () => {
    const result = randomRoleAssignments(participants(6), cards(6), alwaysZero);

    expect(result).toHaveLength(6);
    expect(new Set(result.map((assignment) => assignment.roleCardId)).size).toBe(6);
    expect(new Set(result.map((assignment) => assignment.participantId)).size).toBe(6);
  });

  it('주입한 random으로 결과가 결정적이다 — 항상 0이면 카드가 한 칸 왼쪽으로 회전한다', () => {
    const result = randomRoleAssignments(participants(6), cards(6), alwaysZero);

    expect(result).toEqual([
      { participantId: 1, roleCardId: 2 },
      { participantId: 2, roleCardId: 3 },
      { participantId: 3, roleCardId: 4 },
      { participantId: 4, roleCardId: 5 },
      { participantId: 5, roleCardId: 6 },
      { participantId: 6, roleCardId: 1 },
    ]);
  });

  it('같은 random을 두 번 주면 같은 결과가 나온다', () => {
    const first = randomRoleAssignments(participants(4), cards(4), alwaysZero);
    const second = randomRoleAssignments(participants(4), cards(4), alwaysZero);

    expect(first).toEqual(second);
  });

  it('참여자 3명 / 카드 6장이면 3건만 나온다 — 남는 카드는 버린다', () => {
    const result = randomRoleAssignments(participants(3), cards(6), alwaysZero);

    expect(result).toHaveLength(3);
    expect(new Set(result.map((assignment) => assignment.roleCardId)).size).toBe(3);
  });

  it('참여자 7명 / 카드 6장이면 6건만 나온다 — 빈손이 생겨도 던지지 않는다', () => {
    const result = randomRoleAssignments(participants(7), cards(6), alwaysZero);

    expect(result).toHaveLength(6);
    expect(new Set(result.map((assignment) => assignment.roleCardId)).size).toBe(6);
    expect(result.map((assignment) => assignment.participantId)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('반환 순서는 참여자 목록 순서를 따른다 — PUT 호출 순서가 예측 가능해야 한다', () => {
    const list = [participant(9), participant(4), participant(7)];

    const result = randomRoleAssignments(list, cards(3), alwaysZero);

    expect(result.map((assignment) => assignment.participantId)).toEqual([9, 4, 7]);
  });

  it('참여자가 없으면 빈 배열', () => {
    expect(randomRoleAssignments([], cards(6), alwaysZero)).toEqual([]);
  });

  it('카드가 없으면 빈 배열', () => {
    expect(randomRoleAssignments(participants(3), [], alwaysZero)).toEqual([]);
  });

  it('전원 PENDING이면 빈 배열', () => {
    const list = [participant(1, { participantStatus: 'PENDING' }), participant(2, { participantStatus: 'PENDING' })];

    expect(randomRoleAssignments(list, cards(3), alwaysZero)).toEqual([]);
  });

  it('입력 배열을 변형하지 않는다 — 호출부가 서버 응답 배열을 그대로 넘긴다', () => {
    const list = participants(4);
    const cardList = cards(4);
    const listSnapshot = [...list];
    const cardSnapshot = [...cardList];

    randomRoleAssignments(list, cardList, alwaysZero);

    expect(list).toEqual(listSnapshot);
    expect(cardList).toEqual(cardSnapshot);
    expect(cardList.map((c) => c.roleCardId)).toEqual([1, 2, 3, 4]);
  });

  it('random을 주지 않아도 동작한다 — 기본값 Math.random', () => {
    const result = randomRoleAssignments(participants(6), cards(6));

    expect(result).toHaveLength(6);
    expect(new Set(result.map((assignment) => assignment.roleCardId)).size).toBe(6);
  });

  it('random이 1에 가까운 값을 줘도 카드 범위를 벗어나지 않는다 — 셔플 인덱스가 배열 밖으로 나가면 undefined가 배정된다', () => {
    const result = randomRoleAssignments(participants(6), cards(6), () => 0.999999);

    expect(result).toHaveLength(6);
    expect(new Set(result.map((assignment) => assignment.roleCardId))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });
});
