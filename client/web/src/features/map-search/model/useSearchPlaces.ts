'use client';

import { useMemo } from 'react';
import { formatDistance } from '@shared/config/geo';
import type { Coordinates } from '@shared/config/geo';
import { useSearchMapApiV1MapSearchGet } from '@/services/api/map/map';
import type { SearchResponse, SearchResultPlace } from './types';

const SEARCH_STALE_TIME_MS = 30 * 1000;
const MISSION_TYPE_LABEL: Record<string, string> = { TREASURE: '보물찾기', COOPERATIVE: '협동미션' };

// 좌표를 소수점 4자리(약 11m 단위)로 반올림해 쿼리키를 안정화 (entities/location의 useCurrentAddress와 동일한 방식)
function roundCoord(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function useSearchPlaces(keyword: string, coords: Coordinates | null) {
  const trimmed = keyword.trim();
  const roundedCoords = coords ? { lat: roundCoord(coords.lat), lng: roundCoord(coords.lng) } : null;

  const query = useSearchMapApiV1MapSearchGet(
    { keyword: trimmed, userLatitude: roundedCoords?.lat ?? 0, userLongitude: roundedCoords?.lng ?? 0 },
    {
      query: {
        enabled: coords !== null && trimmed !== '',
        staleTime: SEARCH_STALE_TIME_MS,
        // 검색 실패를 화면에서 직접 처리해야 해서(19지도phase3-map_search.md) queryClient 기본값(throwOnError:true)을 이 쿼리에서만 끈다.
        throwOnError: false,
      },
    },
  );

  const data = useMemo<SearchResponse | undefined>(() => {
    if (!query.data) return undefined;

    const recommended: SearchResultPlace[] = query.data.recommendedLocations.map((location) => ({
      id: location.locationId,
      name: location.locationTitle,
      categoryLabel: location.locationCategory,
      distanceLabel: formatDistance(location.distanceMeter),
      representativeImageUrl: location.representativeImageUrl ?? null,
    }));

    const mission: SearchResultPlace[] = query.data.missionLocations.map((location) => ({
      id: location.locationId,
      name: location.locationTitle,
      categoryLabel: MISSION_TYPE_LABEL[location.missionType] ?? location.missionType,
      distanceLabel: formatDistance(location.distanceMeter),
      representativeImageUrl: location.representativeImageUrl ?? null,
    }));

    return { recommended, mission };
  }, [query.data]);

  return { ...query, data };
}
