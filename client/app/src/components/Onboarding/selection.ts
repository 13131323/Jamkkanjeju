/**
 * 온보딩 단계별 선택 상태를 다루는 순수 로직.
 * step1은 다중 선택(string[]), step2·step3은 단일 선택(string | null)이라
 * "하나 이상 골랐는가" 판정을 양쪽 모두 받도록 한곳에 모은다.
 */

export function hasSelection(selected: readonly string[] | string | null): boolean {
  if (Array.isArray(selected)) return selected.length > 0;
  return selected !== null;
}

// 호출부가 @packages/shared의 TravelInterestId 같은 리터럴 유니온을 넘겨도
// 반환 타입이 string[]으로 넓어지지 않도록 제네릭으로 받는다.
export function toggleSelection<T extends string>(selected: T[], id: T, max: number): T[] {
  if (selected.includes(id)) return selected.filter((v) => v !== id);
  // 상한을 넘기면 같은 배열을 그대로 돌려줘 불필요한 리렌더를 만들지 않는다.
  if (selected.length >= max) return selected;
  return [...selected, id];
}
