import type { NormalizedGuestbook } from './normalizeGuestbook';

// 'mine'/'liked'는 정렬 기준이 아니라 필터다 — 정렬 메뉴 하나로 필터까지 겸한다(기획 요청).
export type SortOption = 'latest' | 'popular' | 'mine' | 'liked';

export const SORT_OPTION_LABEL: Record<SortOption, string> = {
  latest: '최신순',
  popular: '인기순',
  mine: '내가 남긴 흔적',
  liked: '마음에 담은 흔적',
};

function compareBySavedAt(a: NormalizedGuestbook, b: NormalizedGuestbook): number {
  return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
}

// 좋아요 많은 순. 좋아요 수가 같으면(0개끼리도 흔하다) 최신 저장순으로 묶어 순서가 매번 흔들리지 않게 한다.
function compareByPopularity(a: NormalizedGuestbook, b: NormalizedGuestbook): number {
  const likeDiff = (b.likeCount ?? 0) - (a.likeCount ?? 0);
  return likeDiff !== 0 ? likeDiff : compareBySavedAt(a, b);
}

// 'mine'/'liked'로 걸러진 목록 안에서도 정렬 기준은 최신순이다.
export function sortGuestbooks(records: NormalizedGuestbook[], option: SortOption): NormalizedGuestbook[] {
  const compare = option === 'popular' ? compareByPopularity : compareBySavedAt;
  return [...records].sort(compare);
}

// '마음에 담은 흔적' 전용 필터. 'mine'은 서버 scope(GuestbookScope.MINE)로 이미 걸러져서 여기서 다시 거를 필요가 없다.
export function filterGuestbooksBySortOption(records: NormalizedGuestbook[], option: SortOption): NormalizedGuestbook[] {
  if (option === 'liked') return records.filter((record) => record.isLiked === true);
  return records;
}
