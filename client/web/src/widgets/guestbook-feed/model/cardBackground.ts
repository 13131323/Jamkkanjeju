import type { NormalizedGuestbook } from './normalizeGuestbook';

// contentColorCode는 카드 종류가 아니라 모든 카드 공통의 배경색 오버라이드다 (02.md 5장).
// 없으면 undefined를 반환하고, 각 카드 컴포넌트는 자기 기본 배경을 그대로 쓴다.
export function getCardBackgroundColor(record: NormalizedGuestbook): string | undefined {
  return record.contentColorCode ?? undefined;
}
