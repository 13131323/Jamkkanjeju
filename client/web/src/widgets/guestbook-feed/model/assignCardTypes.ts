import type { NormalizedGuestbook } from './normalizeGuestbook';
import type { CardType } from './types';

// 동률일 때 타이브레이크 순서 — 조정하고 싶으면 이 배열만 바꾸면 된다.
const CARD_TYPE_PRIORITY: CardType[] = ['photo', 'note', 'audio'];

export type CardCandidatesFn = (record: NormalizedGuestbook) => CardType[];
export type AssignStrategy = (records: NormalizedGuestbook[], getCandidates: CardCandidatesFn) => Map<string, CardType>;

function pickLeastUsed(candidates: CardType[], usageCount: Record<CardType, number>): CardType {
  return [...candidates].sort((a, b) => {
    const usageDiff = usageCount[a] - usageCount[b];
    if (usageDiff !== 0) return usageDiff;
    return CARD_TYPE_PRIORITY.indexOf(a) - CARD_TYPE_PRIORITY.indexOf(b);
  })[0];
}

// 기본 전략: "지금까지 가장 적게 쓰인 카드 타입"을 우선 배정 (그리디, 정렬 확정 후 1회만 호출할 것 — 02.md 3장)
export const leastUsedFirstStrategy: AssignStrategy = (records, getCandidates) => {
  const assigned = new Map<string, CardType>();
  const usageCount: Record<CardType, number> = { photo: 0, note: 0, audio: 0 };

  for (const record of records) {
    const candidates = getCandidates(record);
    if (candidates.length === 0) continue; // 후보 없는(빈) 방명록은 피드에서 제외

    const chosen = pickLeastUsed(candidates, usageCount);
    assigned.set(record.key, chosen);
    usageCount[chosen] += 1;
  }

  return assigned;
};

export function assignCardTypes(
  records: NormalizedGuestbook[],
  getCandidates: CardCandidatesFn,
  strategy: AssignStrategy = leastUsedFirstStrategy,
): Map<string, CardType> {
  return strategy(records, getCandidates);
}
