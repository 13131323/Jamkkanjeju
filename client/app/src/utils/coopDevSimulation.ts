import { COOP_STEP, PARTICIPANT_ROLE, PARTICIPANT_STATUS, ROLE_PROGRESS_STATUS, type CoopMissionProgressResponse, type Participant, type RoleCard, type RoleProgress } from '@packages/shared';

/**
 * [테스트용] 협동 미션 폴링 응답 위에 가짜 팀원을 덧씌우는 순수 함수.
 *
 * 방장 혼자 기기 하나로는 흐름을 끝까지 볼 수 없다 — 팀원이 들어오고, 역할이 배정되고,
 * 그 사람들이 사진 인증을 마쳐야 다음 단계로 넘어가기 때문이다. 기기를 여러 대 모으지 않고도
 * 초대 → 수락 → 전원 인증 → 완료를 한 대에서 확인하려고 응답에 세 명을 얹는다.
 * 보물찾기의 treasureApproachSimulation.ts가 같은 이유로 좌표를 만들어 내는 것과 같은 자리다.
 *
 * **이 모듈은 `__DEV__`를 직접 읽지 않는다.** 켜짐/꺼짐은 호출부가 판단해 `enabled`로 넘기고,
 * 여기서는 꺼진 상태를 1급으로 다룬다 — 전역 플래그를 읽는 순간 테스트에서 끄고 켤 수 없어지고,
 * 배포 빌드에서 안 켜진다는 것을 함수 자체로 보일 수 없다.
 */

/** 화면에 보일 가짜 팀원. 수락 카드를 구분할 수 있게 이름은 서로 다르다 */
const DEV_SIM_MEMBERS = [
  { participantId: -101, name: '김주연' },
  { participantId: -102, name: '박서진' },
  { participantId: -103, name: '이나연' },
] as const;

/**
 * 가짜 팀원의 participantId. 서버 id와 절대 겹치지 않도록 음수를 쓴다 —
 * 겹치면 실제 참여자를 시뮬레이션으로 오인해 수락 요청이 엉뚱한 곳으로 간다.
 */
export const DEV_SIM_PARTICIPANT_IDS: readonly number[] = DEV_SIM_MEMBERS.map((member) => member.participantId);

/** 시뮬레이션 참여자인지. 호출부가 "이건 서버에 보내지 말 것"을 판정하는 데 쓴다 */
export function isSimulatedParticipant(participantId: number): boolean {
  return DEV_SIM_PARTICIPANT_IDS.includes(participantId);
}

/**
 * **신원 판정의 근거가 되는 "진짜 참여자"만** 남긴다.
 *
 * 화면에 보일 목록과 "내가 누구인가"를 정하는 근거는 달라야 한다. 시뮬레이션이 붙인 사람은
 * 서버에 존재하지 않으므로 절대 내가 될 수 없고, 역할을 배정받을 수도 없다 — 그런데 그들이
 * 섞인 목록으로 신원을 정하면 **심사위원용 모드를 켜는 순간 판정이 어긋난다.**
 *
 * 특히 `party.ts`의 `soleParticipantId`가 그렇다. 그 함수는 "참여자가 한 명뿐이면 그 한 명이
 * 나"라는 규칙인데, 가짜 3명이 섞이면 혼자 만든 방도 4명이 되어 언제나 null이 된다 —
 * 첫 폴링이 오기 전까지 내가 누구인지 모르는 상태가 된다. 그래서 그 규칙에 넣기 전에 여기를 지난다.
 *
 * 역할 배정도 같은 이유로 이 목록을 쓴다(`useCoopMission.ts`의 `assignRolesAndAdvance`).
 */
export function realParticipants<T extends { participantId: number }>(participants: T[]): T[] {
  if (!participants.some((participant) => isSimulatedParticipant(participant.participantId))) return participants;
  return participants.filter((participant) => !isSimulatedParticipant(participant.participantId));
}

/**
 * 가짜 인증 사진의 **폴백** 주소. 실제로 뜨지 않는 주소여도 되지만 **빈 문자열이면 안 된다** —
 * 화면이 "사진 있음"을 문자열 유무로 판정하므로 빈 값은 미인증으로 읽힌다.
 *
 * 호출부가 `itemPhotoByRole`(아래 `SimulateOptions`)을 넘기면 역할에 맞는 사진을 쓰고,
 * 이 값은 사진을 못 받은 경우(예: 이 파일만 부르는 테스트)에만 쓰인다. 예전에는 이 상수 하나가
 * 항상 쓰여서, 실기기에서 step3의 "함께하는 역할" 사진 자리가 **죽은 주소 때문에 영원히
 * 빈 스켈레톤**으로 남았다(RoleVerify.tsx가 로드 실패 주소는 다시 그리지 않는다) — 사용자가
 * 신고한 "다른 팀원 사진이 비어 있다"의 원인이 이것이다.
 */
const DEV_SIM_ITEM_IMG_URL = 'https://dev.invalid/tamnalog/coop-sim-item.png';

/**
 * 가짜 팀원의 인증 사진. **역할명으로 고른다.**
 *
 * 참여자 id로 골랐더니 바로 옆의 "이런 장소를 찾아보세요" 칩과 사진이 어긋났다 — 그 칩은
 * 역할 카드의 `locationToFind`에서 나오므로(RoleDetail.tsx), 사진도 같은 역할에서 나와야
 * 물지기 칩 옆에 물 사진이 선다.
 *
 * 역할은 한 사람당 하나라 "인원마다 각자 사진"은 그대로 성립한다. 수락·거절로 명단이 바뀌어
 * 역할 배정이 달라지면 사진도 그 역할을 따라간다 — 칩과 맞추는 것이 목적이므로 그게 맞다.
 *
 * 랜덤이 아니라 조회다 — 2초 폴링마다, 리렌더마다 같은 역할은 같은 사진을 낸다.
 * 모르는 역할명이면 받은 사진 중 첫 장으로 떨어진다(빈 값이면 화면이 미인증으로 읽는다).
 */
export function simPhotoForRole(roleName: string, byRole: Readonly<Record<string, string>>): string {
  const matched = byRole[roleName];
  if (matched) return matched;

  const [first] = Object.values(byRole);
  return first ?? DEV_SIM_ITEM_IMG_URL;
}

/** 진행도 id도 음수로. 이유는 participantId와 같고, 참여자 id에서 파생시켜 서로 겹치지 않게 한다 */
function simRoleProgressId(participantId: number): number {
  return participantId * 10;
}

/** `PENDING`(초대만 보낸 상태) / `ACCEPTED`(방장이 수락) 두 상태를 acceptedSimIds가 가른다 */
function simParticipant(member: (typeof DEV_SIM_MEMBERS)[number], acceptedSimIds: readonly number[]): Participant {
  return {
    participantId: member.participantId,
    name: member.name,
    participantRole: PARTICIPANT_ROLE.MEMBER,
    participantStatus: acceptedSimIds.includes(member.participantId) ? PARTICIPANT_STATUS.ACCEPTED : PARTICIPANT_STATUS.PENDING,
  };
}

/**
 * 수락된 가짜 팀원에게 붙일 역할 진행도.
 *
 * 언제나 `COMPLETED` + 사진이 있는 상태로 만든다. 이 사람들은 카메라를 켤 수 없으므로
 * 미인증으로 두면 전원 인증 조건(allRolesVerified)에 영원히 도달하지 못하고,
 * 방장이 자기 사진을 올려도 step3에 갇힌다.
 *
 * 역할 카드는 **아직 아무도 맡지 않은 카드**에서 앞에서부터 고른다 — 이미 배정된 카드를 다시 쓰면
 * 같은 역할이 둘이 되어 화면의 역할 목록과 서버 집계가 어긋난다. 남는 카드가 없으면 그 사람은
 * 건너뛴다(카드보다 사람이 많은 것은 정상이다).
 *
 * 인증 사진은 여기서 정한 **역할명**으로 고른다(`simPhotoForRole`) — 같은 카드에서 나오는
 * "이런 장소를 찾아보세요" 칩과 사진이 어긋나지 않게 하려는 것이다.
 */
function simRoleProgresses(acceptedMembers: readonly (typeof DEV_SIM_MEMBERS)[number][], availableCards: readonly RoleCard[], itemPhotoByRole: Readonly<Record<string, string>>): RoleProgress[] {
  return acceptedMembers.slice(0, availableCards.length).map((member, index) => ({
    roleProgressId: simRoleProgressId(member.participantId),
    participantId: member.participantId,
    participantName: member.name,
    roleCardId: availableCards[index].roleCardId,
    roleName: availableCards[index].roleName,
    progressStatus: ROLE_PROGRESS_STATUS.COMPLETED,
    itemImgUrl: simPhotoForRole(availableCards[index].roleName, itemPhotoByRole),
  }));
}

export interface SimulateOptions {
  /** 방장이 수락한 가짜 팀원. **1단계에서만 쓴다**(2단계부터는 전원 수락된 것으로 본다) */
  acceptedSimIds: number[];
  /** 방장이 거절한 가짜 팀원. 어느 단계에서도 목록에 넣지 않는다 */
  rejectedSimIds?: number[];
  /**
   * 폴링 응답에 `roleCards`가 없을 때 대신 쓸 카드.
   *
   * 화면은 방 생성 응답에서 받아 둔 카드를 폴백으로 쓰는데, 시뮬레이션이 그 폴백을 모르면
   * 팀원에게 배정할 카드를 못 찾아 "함께하는 역할"이 비어 버린다.
   */
  fallbackRoleCards?: RoleCard[];
  /**
   * 역할명 → 가짜 팀원 인증 사진. 실제 로컬 에셋을 URI로 바꿔 둔 값을 호출부(useCoopMission.ts)가
   * 넘긴다 — 이 파일은 RN을 import하지 않는 순수 모듈이라(위 주석·테스트 참고) 에셋을 직접
   * `require`하지 않는다. 넘기지 않으면 `DEV_SIM_ITEM_IMG_URL` 폴백을 쓴다.
   */
  itemPhotoByRole?: Record<string, string>;
  enabled: boolean;
}

/**
 * 응답에 가짜 팀원을 덧씌운다. 원본은 읽기만 하고 새 객체를 돌려준다 —
 * 폴링 응답은 캐시에 그대로 남아야 하고, 여기서 변형하면 시뮬레이션 값이 캐시에 눌러붙는다.
 *
 * 꺼져 있거나 덧씌울 것이 없는 단계에서는 **같은 참조를** 돌려준다. 폴링이 2초마다 도는데
 * 값이 같은데도 새 객체를 만들면 화면이 매 주기 다시 그려진다(coopStatusMerge.ts와 같은 규칙).
 *
 * 단계별로 서버가 채우는 필드가 다르므로(계약 문서의 단계별 표) 덧씌우는 범위도 단계를 따른다.
 * 1단계는 참여자만, 2·3단계는 역할까지, 4단계는 참여자 자체가 `null`이라 손댈 것이 없다.
 */
export function simulateCoopStatus(status: CoopMissionProgressResponse, options: SimulateOptions): CoopMissionProgressResponse {
  const { acceptedSimIds, rejectedSimIds = [], fallbackRoleCards = [], itemPhotoByRole = {}, enabled } = options;

  if (!enabled) return status;
  if (status.currentStep === COOP_STEP.COMPLETE) return status;

  const members = DEV_SIM_MEMBERS.filter((member) => !rejectedSimIds.includes(member.participantId));

  const assignsRoles = status.currentStep === COOP_STEP.ROLE_ASSIGNMENT || status.currentStep === COOP_STEP.MISSION;

  // 2·3단계에는 수락 UI가 없다. 그 단계까지 왔다는 건 이미 다 수락했다는 뜻이므로
  // 수락 목록을 보지 않고 전원을 ACCEPTED로 본다 — `acceptedSimIds`는 메모리에만 있어서
  // 앱을 다시 켜거나 이어하기로 곧장 3단계에 들어오면 비어 있고, 그러면 팀원이 통째로 사라졌다.
  const participants: Participant[] = [...(status.participants ?? []), ...members.map((member) => simParticipant(member, assignsRoles ? DEV_SIM_PARTICIPANT_IDS : acceptedSimIds))];

  if (!assignsRoles) return { ...status, participants };

  const roleProgresses = status.roleProgresses ?? [];

  /**
   * **진짜 역할 배정이 하나도 없으면 가짜 역할도 붙이지 않는다.**
   *
   * 시뮬레이션은 화면을 채워 흐름을 끝까지 보게 하려는 것이지, **서버 상태를 가려서는 안 된다.**
   * 가짜 팀원의 진행도는 언제나 `COMPLETED`라(아래 `simRoleProgresses`) 진짜 배정이 아직
   * 도착하지 않은 순간에 붙이면 목록이 "완료된 가짜 3명"만 남는다. 그 목록은
   *   - "함께하는 역할"에 3명이 전원 인증 완료로 그려지는데 **"나의 역할"만 비어 있고**,
   *   - `allRolesVerified`가 참이 되어 **"다음"이 열린다**
   * 는 상태를 만든다. 실제로 그 창이 존재한다: 초대 화면의 "다음"은
   * `PATCH progress(2단계)` → 참여자별 `PUT role-assignments` → `PATCH progress(3단계)` 순으로
   * 도는데(useCoopMission.ts의 `assignRolesAndAdvance`), 그 사이의 응답은 `roleProgresses: []`다.
   * 지금은 2단계가 초대 화면에 머물러(coopStep.ts) 그 구간에 재료 찾기로 넘어가지는 않지만,
   * 이 함수는 **단계와 무관하게** 응답을 덧씌우므로 게이트는 그대로 필요하다 — 3단계 응답이
   * 먼저 오고 역할이 아직 비어 있는 구간이 남고, 중간에 배정이 실패하면 그 상태가 굳는다.
   *
   * `[]`(배정 전)와 `null`(서버가 이 단계에서 안 내려줌)을 가르지 않는 이유는 둘 다 "붙일
   * 진짜 역할이 없다"로 같기 때문이다. 배정이 도착하는 순간 다음 폴링에서 가짜도 함께 붙는다.
   */
  if (roleProgresses.length === 0) return { ...status, participants };

  const takenRoleCardIds = new Set(roleProgresses.map((progress) => progress.roleCardId));
  // 폴링 응답이 역할 카드를 비워 보낼 때가 있다. 그때 화면은 방 생성 응답에서 받아 둔 카드를 쓰는데
  // 여기서 빈 배열로 보면 **내 역할만 그려지고 팀원 역할이 전부 사라진다.** 같은 폴백을 받아 쓴다.
  const sourceCards = status.roleCards ?? fallbackRoleCards;
  const availableCards = sourceCards.filter((card) => !takenRoleCardIds.has(card.roleCardId));

  const added = simRoleProgresses(members, availableCards, itemPhotoByRole);
  // 붙일 것이 없으면 역할 필드를 건드리지 않는다. `null`을 `[]`로 바꾸면 mergeCoopStatus가
  // "값이 왔다"로 읽어 직전 응답의 역할 목록을 덮어 버린다.
  if (added.length === 0) return { ...status, participants };

  return {
    ...status,
    participants,
    roleProgresses: [...roleProgresses, ...added],
    // 집계는 응답에 있을 때만 손댄다 — 서버가 준 적 없는 값을 만들어 내면 화면이 없는 수를 그린다.
    ...(typeof status.completedRoleCount === 'number' ? { completedRoleCount: status.completedRoleCount + added.length } : {}),
    ...(typeof status.totalRoleCount === 'number' ? { totalRoleCount: status.totalRoleCount + added.length } : {}),
  };
}

/**
 * 참여자 목록에만 가짜 팀원을 얹는다.
 *
 * `simulateCoopStatus`는 폴링 응답 전체를 받는데, **첫 폴링이 오기 전에는 그 응답이 없다.**
 * 그 구간에 화면은 방 생성·이어하기 응답(스토어의 `participants`)을 그리므로 시뮬레이션이
 * 통째로 건너뛰어졌다 — "가짜 팀원 3명이 아예 안 보인다"의 원인이 이것이다.
 * 폴링이 실패해 계속 응답이 없는 경우에도 같은 구멍이 생긴다.
 *
 * 초대 단계에서 필요한 것은 참여자뿐이라(역할은 2단계부터다) 이 작은 진입점만 따로 둔다.
 * 이미 들어 있으면 다시 넣지 않는다 — 폴링 응답과 스토어 값 양쪽에 적용돼도 중복되지 않아야 한다.
 *
 * **거절한 사람은 다시 붙이지 않는다.** 거절은 "목록에서 빠짐"으로 표현되는데, 이 함수가
 * "없으면 넣는다"로만 동작하면 방금 지운 사람을 그 자리에서 되살려 거절이 없던 일이 된다.
 */
export function simulateParticipants(participants: Participant[], acceptedSimIds: number[], rejectedSimIds: number[], enabled: boolean): Participant[] {
  if (!enabled) return participants;

  const missing = DEV_SIM_MEMBERS.filter((member) => !rejectedSimIds.includes(member.participantId) && !participants.some((participant) => participant.participantId === member.participantId));
  // 붙일 것이 없으면 같은 참조를 그대로 돌려준다 — 폴링마다 새 배열을 만들면
  // 변화 감지 effect가 2초마다 다시 돈다.
  if (missing.length === 0) return participants;

  return [...participants, ...missing.map((member) => simParticipant(member, acceptedSimIds))];
}
