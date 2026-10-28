import { COOP_STEP, type CoopMissionProgressResponse, type RoleCard, type RoleProgress } from '@packages/shared';
import { describe, expect, it } from 'vitest';
import { DEV_SIM_PARTICIPANT_IDS, isSimulatedParticipant, realParticipants, simulateCoopStatus, simulateParticipants } from './coopDevSimulation';
import { canCompleteCoopMission, myRoleProgress, otherRoleProgresses } from './coopRole';
import { soleParticipantId } from './party';

const [SIM_A, SIM_B, SIM_C] = DEV_SIM_PARTICIPANT_IDS;

function card(roleCardId: number, roleName = `역할${roleCardId}`): RoleCard {
  return {
    roleCardId,
    roleName,
    roleDescription: '설명',
    locationToFind: ['용천수', '물길'],
  };
}

function progress(participantId: number, roleCardId: number): RoleProgress {
  return {
    roleProgressId: participantId * 10,
    participantId,
    participantName: `참여자${participantId}`,
    roleCardId,
    roleName: `역할${roleCardId}`,
    progressStatus: 'IN_PROGRESS',
    itemImgUrl: null,
  };
}

/** 방장 혼자 있는 응답. 단계마다 서버가 채우는 필드만 넣어 준다 */
function status(currentStep: number, overrides: Partial<CoopMissionProgressResponse> = {}): CoopMissionProgressResponse {
  return {
    missionProgressId: 1,
    missionId: 2,
    missionTitle: '함께 만드는 제주',
    missionProgressStatus: 'IN_PROGRESS',
    currentStep,
    participants: [{ participantId: 1, name: '방장', participantRole: 'HOST', participantStatus: 'ACCEPTED' }],
    ...overrides,
  };
}

/** 가짜 팀원만 추린다 — 서버 참여자와 섞여 나오므로 id 부호로 가른다 */
function simParticipants(result: CoopMissionProgressResponse) {
  return (result.participants ?? []).filter((p) => isSimulatedParticipant(p.participantId));
}

function simProgresses(result: CoopMissionProgressResponse) {
  return (result.roleProgresses ?? []).filter((p) => isSimulatedParticipant(p.participantId));
}

describe('DEV_SIM_PARTICIPANT_IDS', () => {
  it('가짜 팀원 3명이고 id가 모두 음수다 — 서버 id(양수)와 겹치면 실제 참여자를 시뮬레이션으로 오인한다', () => {
    expect(DEV_SIM_PARTICIPANT_IDS).toHaveLength(3);
    expect(DEV_SIM_PARTICIPANT_IDS.every((id) => id < 0)).toBe(true);
    expect(new Set(DEV_SIM_PARTICIPANT_IDS).size).toBe(3);
  });
});

describe('isSimulatedParticipant', () => {
  it('가짜 id는 true', () => {
    for (const id of DEV_SIM_PARTICIPANT_IDS) expect(isSimulatedParticipant(id)).toBe(true);
  });

  it('양수 서버 id는 false', () => {
    expect(isSimulatedParticipant(1)).toBe(false);
    expect(isSimulatedParticipant(999)).toBe(false);
    expect(isSimulatedParticipant(0)).toBe(false);
  });
});

describe('simulateCoopStatus - 꺼진 상태', () => {
  it('enabled가 false면 같은 참조를 그대로 돌려준다 — 배포 빌드에서 값을 만들어내지 않고, 참조가 바뀌면 폴링마다 화면이 다시 그려진다', () => {
    const input = status(COOP_STEP.INVITE);
    expect(simulateCoopStatus(input, { acceptedSimIds: [], enabled: false })).toBe(input);
    expect(simulateCoopStatus(input, { acceptedSimIds: [SIM_A, SIM_B, SIM_C], enabled: false })).toBe(input);
  });
});

describe('simulateCoopStatus - 1단계(INVITE)', () => {
  it('가짜 3명이 MEMBER·PENDING으로 서버 참여자 뒤에 붙는다', () => {
    const result = simulateCoopStatus(status(COOP_STEP.INVITE), { acceptedSimIds: [], enabled: true });

    expect(result.participants).toHaveLength(4);
    expect(result.participants?.[0].participantId).toBe(1);
    expect(simParticipants(result)).toEqual([
      { participantId: SIM_A, name: expect.any(String), participantRole: 'MEMBER', participantStatus: 'PENDING' },
      { participantId: SIM_B, name: expect.any(String), participantRole: 'MEMBER', participantStatus: 'PENDING' },
      { participantId: SIM_C, name: expect.any(String), participantRole: 'MEMBER', participantStatus: 'PENDING' },
    ]);
  });

  it('가짜 팀원 이름은 서로 다르다 — 목록에서 누구를 수락했는지 구분할 수 없으면 시뮬레이션이 쓸모없다', () => {
    const names = simParticipants(simulateCoopStatus(status(COOP_STEP.INVITE), { acceptedSimIds: [], enabled: true })).map((p) => p.name);
    expect(new Set(names).size).toBe(3);
  });

  it('원본 participants가 null이면 빈 배열에서 시작한다', () => {
    const result = simulateCoopStatus(status(COOP_STEP.INVITE, { participants: null }), { acceptedSimIds: [], enabled: true });
    expect(result.participants).toHaveLength(3);
  });

  it('역할 필드는 손대지 않는다 — 1단계 응답에는 역할이 없고, null을 []로 바꾸면 이미 배정된 것처럼 보인다', () => {
    const input = status(COOP_STEP.INVITE, { roleCards: null, roleProgresses: null, completedRoleCount: null, totalRoleCount: null });
    const result = simulateCoopStatus(input, { acceptedSimIds: [SIM_A, SIM_B, SIM_C], enabled: true });

    expect(result.roleCards).toBeNull();
    expect(result.roleProgresses).toBeNull();
    expect(result.completedRoleCount).toBeNull();
    expect(result.totalRoleCount).toBeNull();
  });

  it('acceptedSimIds에 든 사람만 ACCEPTED가 된다', () => {
    const result = simulateCoopStatus(status(COOP_STEP.INVITE), { acceptedSimIds: [SIM_B], enabled: true });

    expect(simParticipants(result).map((p) => p.participantStatus)).toEqual(['PENDING', 'ACCEPTED', 'PENDING']);
  });
});

describe('simulateCoopStatus - 2·3단계(ROLE_ASSIGNMENT·MISSION)', () => {
  const roleStatus = (currentStep: number, overrides: Partial<CoopMissionProgressResponse> = {}) =>
    status(currentStep, {
      roleCards: [card(10), card(11), card(12), card(13)],
      roleProgresses: [progress(1, 10)],
      completedRoleCount: 0,
      totalRoleCount: 4,
      ...overrides,
    });

  it.each([COOP_STEP.ROLE_ASSIGNMENT, COOP_STEP.MISSION])('%i단계: 가짜 팀원 전원에게 COMPLETED 역할 진행도가 붙고 itemImgUrl이 채워진다', (step) => {
    // 이 단계에는 수락 UI가 없다. acceptedSimIds가 비어 있어도(앱 재시작·이어하기) 전원에게 붙어야 한다
    const result = simulateCoopStatus(roleStatus(step), { acceptedSimIds: [], enabled: true });
    const added = simProgresses(result);

    expect(added).toHaveLength(3);
    expect(added.map((p) => p.participantId)).toEqual([SIM_A, SIM_B, SIM_C]);
    for (const p of added) {
      expect(p.progressStatus).toBe('COMPLETED');
      expect(typeof p.itemImgUrl).toBe('string');
      expect(p.itemImgUrl).not.toBe('');
    }
  });

  it('붙는 진행도의 참여자 이름은 참여자 목록의 이름과 같다', () => {
    const result = simulateCoopStatus(roleStatus(COOP_STEP.MISSION), { acceptedSimIds: [SIM_A], enabled: true });

    const participant = simParticipants(result).find((p) => p.participantId === SIM_A);
    expect(simProgresses(result)[0].participantName).toBe(participant?.name);
  });

  it('roleProgressId도 음수다 — 서버 진행도 id와 겹치면 인증 요청이 엉뚱한 진행도로 간다', () => {
    const added = simProgresses(simulateCoopStatus(roleStatus(COOP_STEP.MISSION), { acceptedSimIds: [SIM_A, SIM_B, SIM_C], enabled: true }));

    expect(added.every((p) => p.roleProgressId < 0)).toBe(true);
    expect(new Set(added.map((p) => p.roleProgressId)).size).toBe(added.length);
  });

  it('거절한 가짜 팀원에게는 역할이 붙지 않는다 — 방에서 뺀 사람이 인증을 끝낸 것으로 보이면 안 된다', () => {
    const result = simulateCoopStatus(roleStatus(COOP_STEP.MISSION), { acceptedSimIds: [], rejectedSimIds: [SIM_A, SIM_B], enabled: true });

    expect(simProgresses(result).map((p) => p.participantId)).toEqual([SIM_C]);
  });

  it('전원을 거절하면 역할 진행도가 그대로다', () => {
    const input = roleStatus(COOP_STEP.MISSION);
    const result = simulateCoopStatus(input, { acceptedSimIds: [], rejectedSimIds: [SIM_A, SIM_B, SIM_C], enabled: true });

    expect(result.roleProgresses).toEqual(input.roleProgresses);
    expect(result.completedRoleCount).toBe(0);
    expect(result.totalRoleCount).toBe(4);
  });

  it('폴링 응답에 roleCards가 없으면 폴백 카드로 배정한다 — 없으면 팀원 역할이 통째로 사라진다', () => {
    const input = roleStatus(COOP_STEP.MISSION, { roleCards: null });
    const result = simulateCoopStatus(input, { acceptedSimIds: [], fallbackRoleCards: [card(20), card(21), card(22)], enabled: true });

    expect(simProgresses(result).map((p) => p.roleCardId)).toEqual([20, 21, 22]);
  });

  it('이미 배정된 roleCardId는 재사용하지 않는다', () => {
    const result = simulateCoopStatus(roleStatus(COOP_STEP.MISSION), { acceptedSimIds: [SIM_A, SIM_B, SIM_C], enabled: true });
    const cardIds = (result.roleProgresses ?? []).map((p) => p.roleCardId);

    expect(new Set(cardIds).size).toBe(cardIds.length);
    expect(cardIds).toEqual([10, 11, 12, 13]);
  });

  it('남는 역할 카드가 모자라면 붙일 수 있는 만큼만 붙는다', () => {
    const input = roleStatus(COOP_STEP.MISSION, { roleCards: [card(10), card(11)], totalRoleCount: 2 });
    const result = simulateCoopStatus(input, { acceptedSimIds: [SIM_A, SIM_B, SIM_C], enabled: true });

    // 카드 4장 중 10번은 방장이 이미 가져갔으므로 남은 것은 11번 하나뿐이다
    expect(simProgresses(result)).toHaveLength(1);
    expect(simProgresses(result)[0].roleCardId).toBe(11);
  });

  it('역할 카드가 아예 없으면 참여자만 붙는다', () => {
    const input = roleStatus(COOP_STEP.MISSION, { roleCards: null });
    const result = simulateCoopStatus(input, { acceptedSimIds: [], enabled: true });

    expect(simParticipants(result)).toHaveLength(3);
    expect(simProgresses(result)).toHaveLength(0);
  });

  /**
   * 예전에는 진짜 배정이 없어도 가짜 역할을 붙였다. 그러면 목록이 **완료된 가짜 3명뿐**이 되어
   * "나의 역할"은 비어 있는데 `allRolesVerified`가 참이 되고 "다음"이 열린다 —
   * 심사위원용 모드에서 2단계에 갇힌 채 다음만 눌리던 증상이 그것이다(coopDevSimulation.ts 주석).
   */
  it.each<RoleProgress[] | null>([null, []])('진짜 역할 배정이 없으면(roleProgresses=%s) 가짜 역할도 붙이지 않는다 — 시뮬레이션이 서버 상태를 가리면 안 된다', (roleProgresses) => {
    const result = simulateCoopStatus(roleStatus(COOP_STEP.ROLE_ASSIGNMENT, { roleProgresses }), { acceptedSimIds: [], enabled: true });

    expect(simProgresses(result)).toHaveLength(0);
    // 참여자는 그대로 붙는다 — 인원 자동 추가는 이 모드의 의도된 동작이다
    expect(simParticipants(result)).toHaveLength(3);
    // 집계도 손대지 않는다. 붙인 것이 없는데 수만 늘면 화면이 없는 역할을 센다
    expect(result.completedRoleCount).toBe(0);
    expect(result.totalRoleCount).toBe(4);
  });

  it('진짜 배정이 도착하면 그때 가짜 역할도 함께 붙는다 — 막아 두는 것은 배정 전 구간뿐이다', () => {
    const result = simulateCoopStatus(roleStatus(COOP_STEP.MISSION, { roleProgresses: [progress(1, 10)] }), { acceptedSimIds: [], enabled: true });

    expect(simProgresses(result)).toHaveLength(3);
    expect(result.roleProgresses?.[0].roleCardId).toBe(10);
  });

  it('completedRoleCount·totalRoleCount를 덧붙인 수만큼 늘린다', () => {
    // 카드 4장 중 10번은 방장 차지라 남은 3장에 셋이 들어간다
    const result = simulateCoopStatus(roleStatus(COOP_STEP.MISSION), { acceptedSimIds: [], enabled: true });

    expect(result.completedRoleCount).toBe(3);
    expect(result.totalRoleCount).toBe(7);
  });

  it('집계 필드가 응답에 없으면 만들어내지 않는다 — 없던 값이 생기면 화면이 서버가 준 적 없는 수를 그린다', () => {
    const result = simulateCoopStatus(roleStatus(COOP_STEP.MISSION, { completedRoleCount: null, totalRoleCount: undefined }), { acceptedSimIds: [SIM_A], enabled: true });

    expect(result.completedRoleCount).toBeNull();
    expect(result.totalRoleCount).toBeUndefined();
  });
});

describe('simulateCoopStatus - 4단계(COMPLETE)', () => {
  it('아무것도 덧붙이지 않는다 — 그 단계 응답에는 참여자가 없고 보상만 온다', () => {
    const input = status(COOP_STEP.COMPLETE, { participants: null, roleCards: null, roleProgresses: null });
    const result = simulateCoopStatus(input, { acceptedSimIds: [SIM_A, SIM_B, SIM_C], enabled: true });

    expect(result).toBe(input);
    expect(result.participants).toBeNull();
    expect(result.roleProgresses).toBeNull();
  });
});

describe('simulateCoopStatus - 불변성', () => {
  it('입력 객체와 배열을 변형하지 않는다 — 폴링 응답은 캐시에 그대로 남아야 한다', () => {
    const input = status(COOP_STEP.MISSION, {
      roleCards: [card(10), card(11)],
      roleProgresses: [progress(1, 10)],
      completedRoleCount: 0,
      totalRoleCount: 2,
    });
    const snapshot = structuredClone(input);

    simulateCoopStatus(input, { acceptedSimIds: [SIM_A, SIM_B, SIM_C], enabled: true });

    expect(input).toEqual(snapshot);
  });

  it('결과는 새 객체다 — 원본을 덮어쓰면 캐시가 시뮬레이션 값으로 오염된다', () => {
    const input = status(COOP_STEP.INVITE);
    const result = simulateCoopStatus(input, { acceptedSimIds: [], enabled: true });

    expect(result).not.toBe(input);
    expect(result.participants).not.toBe(input.participants);
  });
});

describe('simulateParticipants — 첫 폴링 전 폴백 경로', () => {
  const host = { participantId: 21, name: '나', participantRole: 'HOST', participantStatus: 'ACCEPTED' } as const;

  it('꺼져 있으면 입력을 같은 참조로 돌려준다', () => {
    const participants = [{ ...host }];
    expect(simulateParticipants(participants, [], [], false)).toBe(participants);
  });

  it('켜져 있으면 가짜 팀원 3명이 PENDING으로 붙는다 — 폴링 응답이 없어도 보여야 한다', () => {
    const result = simulateParticipants([{ ...host }], [], [], true);
    expect(result).toHaveLength(4);
    expect(result.slice(1).map((p) => p.participantId)).toEqual([...DEV_SIM_PARTICIPANT_IDS]);
    expect(result.slice(1).every((p) => p.participantStatus === 'PENDING')).toBe(true);
  });

  /**
   * **가짜 팀원은 절대 HOST가 되지 않는다.**
   *
   * 방장 신원은 신원·승계 판정의 근거다(party.ts의 findHost·becameHost, coopParty.ts의
   * resumedAsNewHost). 시뮬레이션이 가짜 방장을 만들면 심사위원용 모드를 켜는 순간 그 판정이
   * 통째로 어긋난다 — 화면에 보이는 목록으로 "누가 방장인가"를 읽고 있기 때문이다.
   * 인원이 자동으로 붙는 것 자체는 의도된 동작이라(사용자 확정) 없애지 않고, 역할만 못 박는다.
   */
  it('가짜 팀원은 전원 MEMBER다 — 방장 판정이 시뮬레이션에 오염되면 안 된다', () => {
    const result = simulateParticipants([{ ...host }], [...DEV_SIM_PARTICIPANT_IDS], [], true);
    const simulated = result.filter((p) => DEV_SIM_PARTICIPANT_IDS.includes(p.participantId));

    expect(simulated).toHaveLength(3);
    expect(simulated.every((p) => p.participantRole === 'MEMBER')).toBe(true);
    // 진짜 방장은 그대로 남는다
    expect(result.filter((p) => p.participantRole === 'HOST').map((p) => p.participantId)).toEqual([host.participantId]);
  });

  it('수락한 팀원은 ACCEPTED로 붙는다', () => {
    const result = simulateParticipants([{ ...host }], [SIM_A], [], true);
    expect(result.find((p) => p.participantId === SIM_A)?.participantStatus).toBe('ACCEPTED');
    expect(result.find((p) => p.participantId === SIM_B)?.participantStatus).toBe('PENDING');
  });

  it('이미 들어 있으면 다시 넣지 않고 같은 참조를 돌려준다 — 폴링 경로와 겹쳐도 중복되지 않아야 한다', () => {
    const already = simulateParticipants([{ ...host }], [], [], true);
    expect(simulateParticipants(already, [], [], true)).toBe(already);
  });

  it('입력 배열을 변형하지 않는다', () => {
    const participants = [{ ...host }];
    simulateParticipants(participants, [], [], true);
    expect(participants).toHaveLength(1);
  });
});

describe('simulateParticipants — 거절한 사람은 되살리지 않는다', () => {
  const host = { participantId: 21, name: '나', participantRole: 'HOST', participantStatus: 'ACCEPTED' } as const;

  it('거절한 id는 다시 붙지 않는다 — 되살리면 거절이 없던 일이 된다', () => {
    const result = simulateParticipants([{ ...host }], [], [SIM_A], true);
    expect(result.some((p) => p.participantId === SIM_A)).toBe(false);
    expect(result.some((p) => p.participantId === SIM_B)).toBe(true);
  });

  it('셋을 다 거절하면 방장만 남고 같은 참조를 돌려준다', () => {
    const participants = [{ ...host }];
    const result = simulateParticipants(participants, [], [...DEV_SIM_PARTICIPANT_IDS], true);
    expect(result).toBe(participants);
  });

  it('수락과 거절이 섞여 있어도 각각 반영된다', () => {
    const result = simulateParticipants([{ ...host }], [SIM_B], [SIM_A], true);
    expect(result.some((p) => p.participantId === SIM_A)).toBe(false);
    expect(result.find((p) => p.participantId === SIM_B)?.participantStatus).toBe('ACCEPTED');
    expect(result.find((p) => p.participantId === SIM_C)?.participantStatus).toBe('PENDING');
  });
});

describe('realParticipants — 신원 판정의 근거', () => {
  const me = { participantId: 7, name: '나', participantRole: 'HOST', participantStatus: 'ACCEPTED' } as const;

  it('가짜 팀원을 걷어낸다', () => {
    const withSim = simulateParticipants([{ ...me }], [], [], true);
    expect(withSim).toHaveLength(4);
    expect(realParticipants(withSim).map((p) => p.participantId)).toEqual([7]);
  });

  it('가짜가 섞이지 않았으면 같은 참조를 돌려준다 — 모드가 꺼진 경로에서 배열을 새로 만들지 않는다', () => {
    const participants = [{ ...me }];
    expect(realParticipants(participants)).toBe(participants);
  });

  /**
   * 이 조합이 심사위원용 모드의 급소다. 가짜가 섞인 목록을 그대로 `soleParticipantId`에 넣으면
   * "참여자가 한 명뿐일 때만 그 사람이 나"라는 규칙이 언제나 null로 떨어져,
   * 첫 폴링이 오기 전까지 내가 누구인지 모르는 상태가 된다("나의 역할"이 비는 원인).
   */
  it('가짜 팀원이 붙어도 혼자 만든 방의 내 신원을 그대로 찾아낸다', () => {
    const withSim = simulateParticipants([{ ...me }], [], [], true);

    expect(soleParticipantId(withSim)).toBeNull();
    expect(soleParticipantId(realParticipants(withSim))).toBe(7);
  });

  it('진짜 참여자가 여럿이면 여전히 단정하지 않는다 — 남을 나로 오인하지 않는 규칙은 그대로다', () => {
    const others = [{ ...me }, { participantId: 8, name: '팀원', participantRole: 'MEMBER', participantStatus: 'ACCEPTED' } as const];

    expect(soleParticipantId(realParticipants(simulateParticipants(others, [], [], true)))).toBeNull();
  });
});

/**
 * 심사위원용 모드에서 실제로 깨졌던 조합을 통째로 못 박는다.
 *
 * 기기에서 보고된 증상: 2단계에서 화면은 재료 찾기로 넘어왔는데 **"나의 역할"만 비어 있고**
 * "다음"은 눌리는 상태. 가짜 팀원의 역할이 언제나 COMPLETED로 붙어서, 진짜 배정이 도착하기 전
 * 구간에 목록이 "완료된 가짜 3명"만 남았기 때문이다.
 */
describe('심사위원용 모드 — 시뮬레이션이 내 신원·내 역할을 가리지 않는다', () => {
  const ME = 7;
  const me = { participantId: ME, name: '나', participantRole: 'HOST', participantStatus: 'ACCEPTED' } as const;

  const room = (roleProgresses: RoleProgress[] | null) =>
    simulateCoopStatus(
      {
        missionProgressId: 1,
        missionId: 2,
        missionTitle: '함께 만드는 제주',
        missionProgressStatus: 'IN_PROGRESS',
        currentStep: COOP_STEP.MISSION,
        currentParticipant: { participantId: ME, participantRole: 'HOST', participantStatus: 'ACCEPTED' },
        participants: [{ ...me }],
        roleCards: [card(10), card(11), card(12), card(13)],
        roleProgresses,
      },
      { acceptedSimIds: [], enabled: true },
    );

  it('배정 전: 가짜 역할이 붙지 않아 "다음"이 열리지 않는다 — 이것이 2단계에 갇힌 채 다음만 눌리던 상태였다', () => {
    const result = room(null);
    const progresses = result.roleProgresses ?? [];

    expect(progresses).toHaveLength(0);
    expect(myRoleProgress(progresses, ME)).toBeNull();
    expect(canCompleteCoopMission(progresses, ME)).toBe(false);
  });

  it('배정 후: 내 역할이 정확히 나오고 가짜 3명은 "함께하는 역할"로 간다', () => {
    const progresses = room([progress(ME, 10)]).roleProgresses ?? [];

    expect(myRoleProgress(progresses, ME)?.roleCardId).toBe(10);
    expect(otherRoleProgresses(progresses, ME).map((p) => p.participantId)).toEqual([SIM_A, SIM_B, SIM_C]);
  });

  it('내 인증이 남아 있으면 "다음"은 비활성 — 가짜 팀원이 전원 완료여도 마찬가지다', () => {
    const progresses = room([progress(ME, 10)]).roleProgresses ?? [];

    expect(otherRoleProgresses(progresses, ME).every((p) => p.progressStatus === 'COMPLETED')).toBe(true);
    expect(canCompleteCoopMission(progresses, ME)).toBe(false);
  });

  it('내가 인증을 마치면 "다음"이 열린다 — 시뮬레이션의 목적(혼자서 끝까지 보기)은 그대로다', () => {
    const progresses = room([{ ...progress(ME, 10), progressStatus: 'COMPLETED' }]).roleProgresses ?? [];

    expect(canCompleteCoopMission(progresses, ME)).toBe(true);
  });

  it('첫 폴링 전에도 신원을 안다 — 방 생성 응답의 진짜 참여자로 판정하기 때문이다', () => {
    expect(soleParticipantId(realParticipants(simulateParticipants([{ ...me }], [], [], true)))).toBe(ME);
  });
});
