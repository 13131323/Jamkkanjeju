'use client';

import { useMemo, useState } from 'react';
import type { GeneratedApi } from '@packages/shared';
import { useGuestbooks } from '@entities/guestbook';
import { assignCardTypes } from './assignCardTypes';
import { buildCardData } from './buildCardData';
import { getCardCandidates } from './cardCandidates';
import { applyCardTypeFilter, applyLocationFilter, getLocationFilterOptions, type FeedFilterValue, type LocationFilterValue } from './filters';
import { resolveSeededLocationFilter } from './locationFilterSeed';
import { normalizeGeneralGuestbook, normalizeRoadGuestbook, type NormalizedGuestbook } from './normalizeGuestbook';
import { filterGuestbooksBySortOption, sortGuestbooks, type SortOption } from './sort';
import type { CardType, GuestbookCardData } from './types';

/** seedLocationTitle: 지도 상세의 "더보기"가 ?location=으로 넘긴 장소명 */
export function useGuestbookFeed(seedLocationTitle: string | null = null) {
  const [pickedLocationFilter, setPickedLocationFilter] = useState<LocationFilterValue | null>(null);
  const [cardTypeFilter, setCardTypeFilter] = useState<FeedFilterValue>('all');
  const [sortOption, setSortOption] = useState<SortOption>('latest');

  // '내가 남긴 흔적'은 서버 scope(MINE)로 조회한다 — '마음에 담은 흔적'(좋아요)은 그런 scope가 없어 client에서 거른다(sort.ts 참고).
  const { data, isLoading, isError } = useGuestbooks(sortOption === 'mine' ? ('MINE' satisfies GeneratedApi.GuestbookScope) : undefined);

  const allRecords = useMemo<NormalizedGuestbook[]>(() => {
    if (!data) return [];
    return [...data.generalGuestbooks.map(normalizeGeneralGuestbook), ...data.roadGuestbooks.map(normalizeRoadGuestbook)];
  }, [data]);

  const locationOptions = useMemo(() => getLocationFilterOptions(data?.visitedLocations ?? []), [data]);

  // 사용자가 칩을 누르기 전까지는 쿼리로 받은 시드를 쓴다. 칩을 한 번이라도 누르면 그쪽이 이긴다 —
  // 시드를 state 초기값으로만 두면 목록이 늦게 도착했을 때 폴백 판단을 할 수 없다.
  const locationFilter = useMemo(
    () => pickedLocationFilter ?? resolveSeededLocationFilter({ seedTitle: seedLocationTitle, locationOptions, isLoading }),
    [pickedLocationFilter, seedLocationTitle, locationOptions, isLoading],
  );

  // 정렬은 카드 배분보다 먼저 확정되어야 한다 — 배분 알고리즘이 순서 의존적이라서 (02.md 9장)
  const filteredAndSorted = useMemo(
    () => sortGuestbooks(filterGuestbooksBySortOption(applyLocationFilter(allRecords, locationFilter), sortOption), sortOption),
    [allRecords, locationFilter, sortOption],
  );

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
    setLocationFilter: setPickedLocationFilter,
    cardTypeFilter,
    setCardTypeFilter,
    sortOption,
    setSortOption,
  };
}
