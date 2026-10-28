'use client';

import { useMemo } from 'react';
import type { RoadGuestbookMarker } from '@entities/guestbook';

export type GuestbookGroupResult = { mode: 'individual'; guestbooks: RoadGuestbookMarker[] } | { mode: 'hidden' };

// level 1~5(detail 티어)에서만 방명록을 개별 마커로 보여준다(클러스터링 없음).
// level 6 이상(wideSplit/wide 티어)은 방명록 마커를 아예 숨긴다.
export function useGuestbookGroups(guestbooks: RoadGuestbookMarker[] | undefined, level: number): GuestbookGroupResult {
  return useMemo(() => {
    if (!guestbooks || level >= 6) return { mode: 'hidden' };
    return { mode: 'individual', guestbooks };
  }, [guestbooks, level]);
}
