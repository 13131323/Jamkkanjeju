import { ROLE_PROGRESS_STATUS, type RoleCard, type RoleProgress } from '@packages/shared';

/**
 * 협동 미션 역할(step2·step3)의 순수 로직.
 *
 * 서버가 주는 `roleCards`(역할 정의)와 `roleProgresses`(누가 어떤 역할을 맡아 어디까지 했는지)를
 * 변형하지 않고 읽는다. 화면은 여기서 나온 값만 그린다.
 */

/**
 * "이런 장소를 찾아보세요" 칩.
 *
 * 서버의 `locationToFind`는 문자열 배열이고 디자인은 그것을 알약 여러 개로 그린다.
 * 예전 계약은 콤마로 이어진 한 줄 문자열이어서 여기서 나눴는데, 지금은 나눌 것이 없다.
 * 그래도 함수를 남기는 이유는 **빈 값·공백이 그대로 알약으로 그려지는 것을 막기 위해서**다.
 */
export function roleChips(locationToFind: string[]): string[] {
  return locationToFind.map((chip) => chip.trim()).filter((chip) => chip.length > 0);
}

export function findRoleCard(roleCards: RoleCard[], roleCardId: number): RoleCard | null {
  return roleCards.find((card) => card.roleCardId === roleCardId) ?? null;
}

/** step2 역할 목록. 선택 여부만 표시하고 서버가 준 카드 순서는 바꾸지 않는다. */
export function roleSelectionItems(roleCards: RoleCard[], selectedRoleCardId: number | null): { card: RoleCard; selected: boolean }[] {
  return roleCards.map((card) => ({
    card,
    selected: card.roleCardId === selectedRoleCardId,
  }));
}

/** 하나만 열리는 역할 아코디언의 다음 상태. 같은 카드를 누르면 닫힌다. */
export function toggleExpandedRoleCardId(currentRoleCardId: number | null, targetRoleCardId: number): number | null {
  return currentRoleCardId === targetRoleCardId ? null : targetRoleCardId;
}

/** 내 역할 진행도. 아직 역할을 고르지 않았으면 null */
export function myRoleProgress(roleProgresses: RoleProgress[], myParticipantId: number | null): RoleProgress | null {
  if (myParticipantId === null) return null;
  return roleProgresses.find((progress) => progress.participantId === myParticipantId) ?? null;
}

/**
 * "나의 역할" 자리에 무엇을 그릴지. 세 가지를 가른다.
 *
 * 재료 찾기 화면은 서버 3단계에서 열리는데, **역할 목록이 그 화면보다 늦게 도착할 수 있다.**
 * 상태 조회는 단계와 역할을 한 응답으로 주지만, 화면이 새로 마운트되면서 좌표를 다시 읽는 동안
 * 캐시가 비어 첫 응답 전까지는 아무것도 없는 구간이 생긴다. 그 구간을 "배정되지 않았다"고
 * 말하면 없는 문제를 알리는 셈이고, 사용자는 할 수 있는 것이 없다고 오해한다.
 *
 *   - `'loading'` — 아직 판단할 재료가 없다. **기다리면 채워진다.** 화면은 스켈레톤을 그린다.
 *     세 경우가 여기 들어온다: 내 신원(`currentParticipant`)이 아직 안 왔다 / 역할 목록이
 *     아직 비어 있다 / 진행도는 왔는데 그 역할의 정의(`roleCards`)가 아직 없다.
 *   - `'missing'` — **배정은 끝났는데 그 안에 내가 없다.** 목록이 채워져 있고 내 신원도 아는데
 *     내 진행도만 없는 경우다. 이건 기다려도 바뀌지 않으므로 문구로 말해야 한다.
 *   - `'ready'` — 내 역할과 그 정의를 모두 안다.
 *
 * 순수 함수로 떼는 이유는 `canCompleteCoopMission`과 같다 — 화면 없이 검증할 수 있어야 하고,
 * 같은 판정이 화면 안에 인라인으로 흩어지면 스켈레톤과 문구가 동시에 뜨거나 둘 다 안 뜬다.
 */
export type MyRoleView = 'loading' | 'missing' | 'ready';

export function myRoleView(roleProgresses: RoleProgress[], roleCards: RoleCard[], myParticipantId: number | null): MyRoleView {
  if (myParticipantId === null) return 'loading';

  const mine = myRoleProgress(roleProgresses, myParticipantId);
  // 목록 자체가 비었으면 아직 안 온 것이고, 남이 있는데 내가 없으면 나만 빠진 것이다
  if (mine === null) return roleProgresses.length === 0 ? 'loading' : 'missing';

  // 진행도는 있는데 카드 정의가 없다 — 역할명·설명·찾을 장소가 전부 그 카드에서 나오므로 그릴 것이 없다.
  // 2·3단계 상태 조회가 `roleCards`를 함께 주므로(계약의 단계별 표) 다음 응답이면 채워진다.
  return findRoleCard(roleCards, mine.roleCardId) === null ? 'loading' : 'ready';
}

/** 나를 뺀 나머지 역할 진행도. step3의 "함께하는 역할" 목록 */
export function otherRoleProgresses(roleProgresses: RoleProgress[], myParticipantId: number | null): RoleProgress[] {
  return roleProgresses.filter((progress) => progress.participantId !== myParticipantId);
}

/** 이미 누군가 맡은 역할 id. step2에서 남은 역할만 고를 수 있게 한다 */
export function takenRoleCardIds(roleProgresses: RoleProgress[]): number[] {
  return roleProgresses.map((progress) => progress.roleCardId);
}

export function isRoleVerified(progress: RoleProgress): boolean {
  return progress.progressStatus === ROLE_PROGRESS_STATUS.COMPLETED;
}

/**
 * 모든 팀원이 인증을 끝냈는지. step3의 "다음"(= 완료 화면) 활성 조건.
 *
 * 빈 목록은 false다 — 역할이 아직 배정되지 않은 상태를 "전원 완료"로 보면
 * 아무도 인증하지 않았는데 완료 화면으로 넘어간다.
 */
export function allRolesVerified(roleProgresses: RoleProgress[]): boolean {
  if (roleProgresses.length === 0) return false;
  return roleProgresses.every(isRoleVerified);
}

/** 인증을 끝낸 역할 수. 디자인에는 없지만 서버의 completedRoleCount와 대조할 때 쓴다 */
export function verifiedRoleCount(roleProgresses: RoleProgress[]): number {
  return roleProgresses.filter(isRoleVerified).length;
}

/**
 * 재료 찾기 화면의 "다음"(= 완료 단계로 올리기)을 누를 수 있는지.
 *
 * 규칙은 사용자가 정한 그대로다: **step3에서 팀원 전원이 인증을 마치면 방장이 아니어도 누구든
 * 누를 수 있다.** 그래서 여기에 방장 조건은 없다 — 넣으면 팀원이 마지막 인증을 마치고도
 * 방장이 돌아올 때까지 완료 화면으로 갈 수 없다.
 *
 * 대신 **"판정이 성립하는 상태인가"**를 앞에 건다. 예전 조건은 `allRolesVerified` 하나뿐이었는데,
 * 그 함수는 목록에 있는 진행도만 본다 — **목록에 내가 없어도 참이 될 수 있다.** 심사위원용 모드가
 * 정확히 그 구멍을 밟았다: 가짜 팀원의 역할 진행도는 언제나 `COMPLETED`로 붙으므로
 * (coopDevSimulation.ts의 `simRoleProgresses`), 내 역할이 아직 서버에 없는 순간에는 목록이
 * "완료된 가짜 3명"뿐이 되어 전원 완료가 참이 된다. 화면은 "나의 역할: 아직 배정되지 않았어요"를
 * 그리는데 "다음"은 열려 있었고, 그 버튼은 아직 2단계인 방을 4단계로 올리려다 거절당한다
 * (기기에서 확인된 증상 — 2단계에 갇힌 채 다음만 눌리는 상태).
 *
 * 그래서 조건을 둘로 나눈다:
 *   1. **내 역할을 안다** — 내 신원(`myParticipantId`)을 알고, 그 신원의 진행도가 목록에 있다.
 *      둘 중 하나라도 없으면 나는 이 미션에서 무엇을 해야 하는지도 모르는 상태다.
 *   2. **전원이 인증을 마쳤다**(`allRolesVerified`). 내 진행도도 그 목록에 들어 있으므로
 *      "내가 인증했는가"는 여기에 이미 포함된다.
 *
 * 빈 목록은 `allRolesVerified`가 이미 거짓으로 잘라 준다(`every`는 빈 배열에서 참이라
 * 그 함수가 길이를 먼저 본다). 1번 조건도 빈 목록에서 거짓이라 이중으로 막힌다.
 */
export function canCompleteCoopMission(roleProgresses: RoleProgress[], myParticipantId: number | null): boolean {
  if (myRoleProgress(roleProgresses, myParticipantId) === null) return false;
  return allRolesVerified(roleProgresses);
}

/**
 * **끊긴 배정을 이어서 할 때** 아직 남은 사람과 남은 카드.
 *
 * 배정은 `PATCH progress(2)` → 참여자별 `PUT role-assignments` → `PATCH progress(3)` 순으로
 * 도는데(useCoopMission.ts의 `assignRolesAndAdvance`), 중간에 끊기면 방이 2단계에 남고
 * **역할이 일부만 저장된 상태**가 된다. 그 방을 되살리려면 다시 배정해야 하는데,
 * 그냥 처음부터 다시 섞으면 안 된다:
 *
 *   `PUT`은 **역할 카드 단위**다(`.../role-assignments/{roleCardId}`). 이미 A카드에 저장된
 *   사람을 새로 섞어 B카드에 쓰면 A카드의 옛 행이 지워지지 않아 **한 사람이 두 역할을 갖는다.**
 *   화면의 역할 목록과 서버 집계가 그 자리에서 어긋난다.
 *
 * 그래서 **이미 배정된 사람과 이미 쓰인 카드는 건드리지 않고** 남은 것만 돌려준다.
 * 끊긴 지점이 어디든(첫 `PUT` 전이든, 마지막 `PATCH` 직전이든) 같은 규칙으로 이어진다 —
 * 전부 배정돼 있으면 남는 것이 없고, 그때 남은 일은 단계를 3으로 올리는 것뿐이다.
 *
 * **시뮬레이션 진행도는 호출부가 미리 걸러서 넘긴다**(`realParticipants`). 가짜 진행도는
 * 남는 카드를 골라 붙는 것이라 여기서 "쓰인 카드"로 세면 진짜 참여자에게 줄 카드가 줄어든다.
 */
export function remainingRoleAssignTargets<P extends { participantId: number }>(
  participants: P[],
  roleCards: RoleCard[],
  savedProgresses: RoleProgress[],
): { participants: P[]; roleCards: RoleCard[] } {
  const assignedParticipantIds = new Set(savedProgresses.map((progress) => progress.participantId));
  const takenRoleCardIds = new Set(savedProgresses.map((progress) => progress.roleCardId));

  return {
    participants: participants.filter((participant) => !assignedParticipantIds.has(participant.participantId)),
    roleCards: roleCards.filter((card) => !takenRoleCardIds.has(card.roleCardId)),
  };
}
