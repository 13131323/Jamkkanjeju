'use client';

import { useMemo, useState } from 'react';
import type { GeneratedApi } from '@packages/shared';
import { useGuestbooks } from '@entities/guestbook';
import { assignCardTypes } from './assignCardTypes';
import { buildCardData } from './buildCardData';
import { getCardCandidates } from './cardCandidates';
import { applyCardTypeFilter, applyLocationFilter, getLocationFilterOptions, type FeedFilterValue, type LocationFilterValue } from './filters';
import { normalizeGeneralGuestbook, normalizeRoadGuestbook, type NormalizedGuestbook } from './normalizeGuestbook';
import { sortGuestbooks, type SortOption } from './sort';
import type { CardType, GuestbookCardData } from './types';

export function useGuestbookFeed() {
  const [onlyMine, setOnlyMine] = useState(false);
  const { data, isLoading, isError } = useGuestbooks(onlyMine ? ('MINE' satisfies GeneratedApi.GuestbookScope) : undefined);

  const [locationFilter, setLocationFilter] = useState<LocationFilterValue>({ type: 'all' });
  const [cardTypeFilter, setCardTypeFilter] = useState<FeedFilterValue>('all');
  const [sortOption, setSortOption] = useState<SortOption>('latest');

  const allRecords = useMemo<NormalizedGuestbook[]>(() => {
    if (!data) return [];
    return [...data.generalGuestbooks.map(normalizeGeneralGuestbook), ...data.roadGuestbooks.map(normalizeRoadGuestbook)];
  }, [data]);

  const locationOptions = useMemo(() => getLocationFilterOptions(allRecords), [allRecords]);

  // 정렬은 카드 배분보다 먼저 확정되어야 한다 — 배분 알고리즘이 순서 의존적이라서 (02.md 9장)
  const filteredAndSorted = useMemo(() => sortGuestbooks(applyLocationFilter(allRecords, locationFilter), sortOption), [allRecords, locationFilter, sortOption]);

  const assignedTypes = useMemo(() => assignCardTypes(filteredAndSorted, getCardCandidates), [filteredAndSorted]);

  // 후보가 없어 배정에서 제외된 레코드는 여기서 걸러낸다
  const renderableRecords = useMemo(() => filteredAndSorted.filter((record) => assignedTypes.has(record.key)), [filteredAndSorted, assignedTypes]);

  // 현재 화면에 실제로 보이는 레코드(위치/카드타입 필터 반영) — cards와 1:1 대응이라 상세 모달 캐러셀 순서로도 그대로 쓴다
  const visibleRecords = useMemo(() => applyCardTypeFilter(renderableRecords, assignedTypes, cardTypeFilter), [renderableRecords, assignedTypes, cardTypeFilter]);

  const cards = useMemo<GuestbookCardData[]>(
    () => visibleRecords.map((record) => buildCardData(record, assignedTypes.get(record.key) as CardType)).filter((card): card is GuestbookCardData => card !== null),
    [visibleRecords, assignedTypes],
  );

  return {
    isLoading,
    isError,
    cards,
    orderedGuestbooks: visibleRecords,
    locationOptions,
    locationFilter,
    setLocationFilter,
    cardTypeFilter,
    setCardTypeFilter,
    sortOption,
    setSortOption,
    onlyMine,
    setOnlyMine,
  };
}
