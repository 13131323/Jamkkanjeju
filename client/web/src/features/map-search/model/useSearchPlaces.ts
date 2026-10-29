'use client';

import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { formatDistance } from '@shared/config/geo';
import type { Coordinates } from '@shared/config/geo';
import { searchMapLocations } from '@shared/api/mapSearch';
import type { SearchResponse } from './types';

const SEARCH_STALE_TIME_MS = 30 * 1000;

// 좌표를 소수점 4자리(약 11m 단위)로 반올림해 쿼리키를 안정화 (entities/location의 useCurrentAddress와 동일한 방식)
function roundCoord(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** 완성된 검색어는 IME 종료 이벤트를 기다리지 않고 입력이 300ms 멈추면 검색한다. */
export function useSearchPlaces(keyword: string, coords: Coordinates | null, isComposing = false) {
  const trimmed = keyword.trim();
  // IME는 완성된 음절에서도 조합 상태를 유지할 수 있으므로 미완성 자모가 있을 때만 기다린다.
  const awaitingComposition = isComposing && /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/.test(trimmed);
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    if (awaitingComposition) return;
    const timer = setTimeout(() => setDebounced(trimmed), 300);
    return () => clearTimeout(timer);
  }, [trimmed, awaitingComposition]);
  const ready = !awaitingComposition && trimmed !== '' && debounced === trimmed;
  const roundedCoords = coords ? { lat: roundCoord(coords.lat), lng: roundCoord(coords.lng) } : null;
  const query = useInfiniteQuery({
    queryKey: ['/api/v2/map/search', debounced, roundedCoords],
    queryFn: ({ pageParam, signal }) => searchMapLocations({
      keyword: debounced, userLatitude: roundedCoords?.lat ?? 0, userLongitude: roundedCoords?.lng ?? 0, page: pageParam, size: 20,
    }, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.locationsPage.hasNext ? lastPage.locationsPage.page + 1 : undefined,
    enabled: coords !== null && ready,
    staleTime: SEARCH_STALE_TIME_MS,
    throwOnError: false,
    retry: (failureCount, error) => {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      return !(status !== undefined && status >= 400 && status < 500) && failureCount < 2;
    },
  });
  const data = useMemo<SearchResponse | undefined>(() => {
    if (!ready || !query.data) return undefined;
    return { locations: query.data.pages.flatMap((page) => page.locations).map((location) => ({
      id: location.locationId, name: location.locationTitle, categoryLabel: location.locationCategory,
      distanceLabel: formatDistance(location.distanceMeter), representativeImageUrl: location.representativeImageUrl,
      mission: location.mission,
    })) };
  }, [query.data, ready]);
  return { ...query, data, isLoading: coords !== null && trimmed !== '' && !awaitingComposition && (!ready || query.isLoading),
    isError: ready && query.isError, hasNextPage: ready && query.hasNextPage };
}
