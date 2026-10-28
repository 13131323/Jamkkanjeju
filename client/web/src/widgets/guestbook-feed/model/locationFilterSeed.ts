import type { LocationFilterValue } from './filters';

type SeedContext = {
  /** 지도 상세의 "더보기"가 넘겨준 장소명 (?location=) */
  seedTitle: string | null;
  locationOptions: string[];
  isLoading: boolean;
};

/**
 * 쿼리로 넘어온 장소명을 실제 필터 값으로 바꾼다.
 *
 * 칩 목록은 피드에 실제로 있는 방명록에서만 만들어진다(getLocationFilterOptions). 그래서 지도 상세엔
 * 방명록이 보였는데 피드엔 없는 장소가 생길 수 있고, 그대로 필터하면 선택된 칩도 목록도 없는 빈 화면이 된다.
 */
export function resolveSeededLocationFilter({ seedTitle, locationOptions, isLoading }: SeedContext): LocationFilterValue {
  if (!seedTitle) return { type: 'all' };
  // 로딩 중엔 칩 목록이 아직 비어 있다 — 여기서 폴백하면 시드가 그냥 버려진다
  if (isLoading || locationOptions.includes(seedTitle)) return { type: 'location', locationTitle: seedTitle };
  return { type: 'all' };
}
