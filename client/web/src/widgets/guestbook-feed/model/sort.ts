import type { NormalizedGuestbook } from './normalizeGuestbook';

export type SortOption = 'latest' | 'visited';

export const SORT_OPTION_LABEL: Record<SortOption, string> = {
  latest: '최신순',
  visited: '방문일순',
};

const SORT_FIELD: Record<SortOption, 'savedAt' | 'visitedAt'> = {
  latest: 'savedAt',
  visited: 'visitedAt',
};

export function sortGuestbooks(records: NormalizedGuestbook[], option: SortOption): NormalizedGuestbook[] {
  const field = SORT_FIELD[option];
  return [...records].sort((a, b) => new Date(b[field]).getTime() - new Date(a[field]).getTime());
}
