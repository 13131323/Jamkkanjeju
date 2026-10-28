import type { CoopMissionProgressResponse, Participant, RoleCard, RoleProgress } from '@packages/shared';
import { describe, expect, it } from 'vitest';
import { mergeCoopStatus } from './coopStatusMerge';

function participant(participantId: number): Participant {
  return {
    participantId,
    name: `참여자${participantId}`,
    participantRole: 'HOST',
    participantStatus: 'ACCEPTED',
  };
}

function card(roleCardId: number): RoleCard {
  return {
    roleCardId,
    roleName: '물지기',
    roleDescription: '설명',
    locationToFind: ['용천수', '물길'],
  };
}

function progress(participantId: number): RoleProgress {
  return {
    roleProgressId: participantId * 10,
    participantId,
    participantName: `참여자${participantId}`,
    roleCardId: participantId,
    roleName: '물지기',
    progressStatus: 'IN_PROGRESS',
    itemImgUrl: null,
  };
}

/** 단계와 상관없이 늘 채워지는 스칼라 필드. 각 케이스는 여기에 단계별 필드만 얹는다 */
function base(currentStep: number, overrides: Partial<CoopMissionProgressResponse> = {}): CoopMissionProgressResponse {
  return {
    missionProgressId: 1,
    missionId: 7,
    missionTitle: '용천수를 찾아라',
    missionProgressStatus: 'IN_PROGRESS',
    currentStep,
    ...overrides,
  };
}

describe('mergeCoopStatus', () => {
  it('prev가 null이면 next를 그대로 준다 — 첫 폴링에는 채울 직전 값이 없다', () => {
    const next = base(1, { participants: [participant(1)] });
    expect(mergeCoopStatus(null, next)).toBe(next);
  });

  it('4단계 응답이 비운 참여자·역할 진행도는 직전 값이 남는다', () => {
    const prev = base(3, {
      currentParticipant: { participantId: 1, participantRole: 'HOST', participantStatus: 'ACCEPTED' },
      participants: [participant(1), participant(2)],
      roleCards: [card(1)],
      roleProgresses: [progress(1)],
      completedRoleCount: 1,
      totalRoleCount: 2,
    });
    const next = base(4, {
      currentParticipant: null,
      participants: null,
      roleCards: null,
      roleProgresses: null,
      completedRoleCount: null,
      totalRoleCount: null,
      reward: { point: 100 },
      nextLocation: { id: 9, locationTitle: '금릉해변', distanceMeter: 1200 },
    });

    const merged = mergeCoopStatus(prev, next);

    expect(merged.participants).toEqual([participant(1), participant(2)]);
    expect(merged.roleProgresses).toEqual([progress(1)]);
    expect(merged.currentParticipant).toEqual(prev.currentParticipant);
    expect(merged.roleCards).toEqual([card(1)]);
    expect(merged.completedRoleCount).toBe(1);
    expect(merged.totalRoleCount).toBe(2);
    // 4단계만 주는 값은 next 그대로다
    expect(merged.reward).toEqual({ point: 100 });
    expect(merged.nextLocation).toEqual({ id: 9, locationTitle: '금릉해변', distanceMeter: 1200 });
  });

  it('1단계에서 2단계로 넘어가며 새로 내려온 roleCards는 next 값을 쓴다', () => {
    const prev = base(1, { participants: [participant(1)], roleCards: null });
    const next = base(2, { participants: [participant(1)], roleCards: [card(1), card(2)] });

    expect(mergeCoopStatus(prev, next).roleCards).toEqual([card(1), card(2)]);
  });

  it('빈 배열은 값이다 — 역할 배정 전 roleProgresses: []가 prev를 덮어쓴다', () => {
    const prev = base(3, { roleProgresses: [progress(1), progress(2)] });
    const next = base(2, { roleProgresses: [] });

    expect(mergeCoopStatus(prev, next).roleProgresses).toEqual([]);
  });

  it('0도 값이다 — completedRoleCount: 0이 prev의 집계를 덮어쓴다', () => {
    const prev = base(3, { completedRoleCount: 2 });
    const next = base(2, { completedRoleCount: 0 });

    expect(mergeCoopStatus(prev, next).completedRoleCount).toBe(0);
  });

  it('undefined도 비어 있는 것으로 본다 — 서버가 키를 아예 빼도 직전 값이 남는다', () => {
    const prev = base(2, { participants: [participant(1)] });
    const next = base(4);

    expect(mergeCoopStatus(prev, next).participants).toEqual([participant(1)]);
  });

  it('채울 것이 없으면 next와 같은 참조를 준다 — 폴링마다 새 객체를 만들면 화면이 2초마다 다시 그려진다', () => {
    const prev = base(2, { participants: [participant(1)], roleCards: [card(1)] });
    const next = base(2, { participants: [participant(1), participant(2)], roleCards: [card(1)], roleProgresses: [], completedRoleCount: 0, totalRoleCount: 2 });

    expect(mergeCoopStatus(prev, next)).toBe(next);
  });

  it('prev에도 next에도 없는 필드는 채울 것이 아니다 — 참조가 유지된다', () => {
    const prev = base(1, { participants: [participant(1)] });
    const next = base(1, { participants: [participant(1)] });

    expect(mergeCoopStatus(prev, next)).toBe(next);
  });

  it('스칼라 필드는 언제나 next를 따른다 — 지금 단계에 대한 진실은 서버뿐이다', () => {
    const prev = base(2, { missionTitle: '옛 제목', missionProgressStatus: 'IN_PROGRESS', participants: [participant(1)] });
    const next = base(4, { missionTitle: '새 제목', missionProgressStatus: 'COMPLETED', participants: null });

    const merged = mergeCoopStatus(prev, next);

    expect(merged.currentStep).toBe(4);
    expect(merged.missionTitle).toBe('새 제목');
    expect(merged.missionProgressStatus).toBe('COMPLETED');
    expect(merged.missionProgressId).toBe(next.missionProgressId);
    expect(merged.missionId).toBe(next.missionId);
  });

  it('머지가 원본을 건드리지 않는다 — prev는 다음 폴링에서도 그대로 쓰인다', () => {
    const prev = base(3, { participants: [participant(1)], roleProgresses: [progress(1)] });
    const next = base(4, { participants: null, roleProgresses: null });

    mergeCoopStatus(prev, next);

    expect(next.participants).toBeNull();
    expect(prev.participants).toEqual([participant(1)]);
  });
});
