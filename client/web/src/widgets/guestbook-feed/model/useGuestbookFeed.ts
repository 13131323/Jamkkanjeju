'use client';

import { useMemo, useState } from 'react';
import { useGuestbooks } from '@entities/guestbook';
import { DEFAULT_GUESTBOOK_FILTERS, type GuestbookFilters, type GuestbookTypeFilter } from '@shared/api/guestbooks';
import { assignCardTypes } from './assignCardTypes';
import { buildCardData } from './buildCardData';
import { getCardCandidates } from './cardCandidates';
import { normalizeGeneralGuestbook, normalizeRoadGuestbook } from './normalizeGuestbook';
import { sortGuestbooks } from './sort';
import type { GuestbookCardData } from './types';

/** 필터링·페이징은 서버에 맡기고 반환된 두 목록을 카드와 상세 모달로 구성한다. */
export function useGuestbookFeed(initialGuestbookType: GuestbookTypeFilter = 'ALL') {
  const [filters, setFilters] = useState<GuestbookFilters>({ ...DEFAULT_GUESTBOOK_FILTERS, guestbookType: initialGuestbookType });
  const [page, setPage] = useState(0);
  const [maxVisitedPage, setMaxVisitedPage] = useState(0);
  const { data, isLoading, isError, isFetching, hasNextPage } = useGuestbooks(page, filters);

  // 각각 정렬된 일반·길바닥 페이지를 화면의 한 목록으로 합친다. 재필터링하거나 다시 페이징하지 않는다.
  const records = useMemo(() => data ? sortGuestbooks([
    ...data.generalGuestbooks.map(normalizeGeneralGuestbook),
    ...data.roadGuestbooks.map(normalizeRoadGuestbook),
  ], filters.sort) : [], [data, filters.sort]);

  const assignedTypes = useMemo(() => assignCardTypes(records, getCardCandidates), [records]);

  const cards = useMemo<GuestbookCardData[]>(() => records.flatMap((record) => {
    const type = assignedTypes.get(record.key);
    const card = type ? buildCardData(record, type) : null;
    return card ? [card] : [];
  }), [records, assignedTypes]);
  const orderedGuestbooks = useMemo(() => records.filter((record) => assignedTypes.has(record.key)), [records, assignedTypes]);

  function changeFilters(next: Partial<GuestbookFilters>) {
    setFilters((old) => ({ ...old, ...next }));
    setPage(0);
    setMaxVisitedPage(0);
  }

  return {
    filters, changeFilters, page,
    maxKnownPage: Math.max(maxVisitedPage, page + (hasNextPage ? 1 : 0)),
    setPage: (next: number) => { setPage(next); setMaxVisitedPage((old) => Math.max(old, next)); },
    hasNextPage, isFetching, isLoading, isError, cards, orderedGuestbooks,
  };
}
