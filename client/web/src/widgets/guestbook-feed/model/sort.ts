import type { GuestbookSort } from '@shared/api/guestbooks';
import type { NormalizedGuestbook } from './normalizeGuestbook';

export const SORT_OPTION_LABEL: Record<GuestbookSort, string> = {
  LATEST: '최신순',
  POPULAR: '인기순',
  MINE: '내 방명록',
  LIKED: '좋아요한 방명록',
};

/** 서버에서 각각 정렬된 두 유형의 페이지를 같은 정렬 기준으로 한 화면에 배치한다. */
export function sortGuestbooks(records: NormalizedGuestbook[], option: GuestbookSort): NormalizedGuestbook[] {
  return [...records].sort((a, b) => {
    const likes = option === 'POPULAR' ? (b.likeCount ?? 0) - (a.likeCount ?? 0) : 0;
    return likes || new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime() || b.id - a.id;
  });
}
