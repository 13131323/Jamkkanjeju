import type { Participant, RoleCard } from '@packages/shared';

/**
 * 협동 미션 역할 랜덤 배정의 순수 로직.
 *
 * 역할 선택 화면이 없어지면서 step1에서 방장이 "다음"을 누르는 순간 클라이언트가 역할을 나눈다.
 * 화면은 여기서 나온 목록을 그대로 순회하며
 * `PUT /cooperative-missions/{progressId}/role-assignments/{roleCardId}`를 호출한다 —
 * 이 파일은 계산만 하고 HTTP는 모른다. 그래야 배정 규칙을 화면 없이 테스트할 수 있다.
 */

/** PUT 한 번에 대응하는 배정 1건 */
export interface RoleAssignment {
  participantId: number;
  roleCardId: number;
}

/**
 * Fisher–Yates 셔플.
 *
 * 인자 배열을 복사한 뒤 섞는다 — 호출부가 서버 응답 배열을 그대로 넘기므로
 * 제자리에서 섞으면 폴링 응답 캐시의 카드 순서가 조용히 바뀐다.
 *
 * `random`을 주입받는 이유는 테스트다. `Math.random`을 직접 부르면 "중복 없이 나눈다" 정도만
 * 확인할 수 있고 어떤 순열이 나왔는지 검증할 수 없다.
 */
function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    // random()이 1을 반환하는 구현을 만나도 인덱스가 배열 밖으로 나가지 않도록 잘라 둔다.
    // 범위를 벗어나면 swap 상대가 undefined가 되어 배정에 빈 카드가 섞인다.
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * 수락한 참여자에게 역할 카드를 중복 없이 하나씩 나눈다.
 *
 * `PENDING`은 방장이 아직 수락하지 않은 참여 요청이라 배정 대상이 아니다. 지금 역할을 주면
 * 나중에 거절했을 때 되돌릴 화면이 없다.
 *
 * 인원과 카드 수가 어긋나도 던지지 않는다 — 방장이 "다음"을 누른 순간이라 예외를 띄우면
 * 미션 자체가 멈춘다. 적은 쪽에 맞춰 배정하고 남는 쪽은 버린다.
 *
 * 반환 순서는 참여자 목록 순서를 따른다. 카드가 아니라 사람 기준으로 정렬해야
 * PUT 호출 순서가 화면에 보이는 순서와 같아져 실패한 배정을 눈으로 짚을 수 있다.
 */
export function randomRoleAssignments(participants: Participant[], roleCards: RoleCard[], random: () => number = Math.random): RoleAssignment[] {
  const targets = participants.filter((participant) => participant.participantStatus === 'ACCEPTED');
  if (targets.length === 0 || roleCards.length === 0) return [];

  const shuffledCards = shuffle(roleCards, random);

  return targets.slice(0, shuffledCards.length).map((participant, index) => ({
    participantId: participant.participantId,
    roleCardId: shuffledCards[index].roleCardId,
  }));
}
