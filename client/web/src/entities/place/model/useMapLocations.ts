'use client';

import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { GeneratedApi } from '@packages/shared';
import type { Bounds, Coordinates } from '@shared/config/geo';
import { buildMapContentsParams } from '@shared/lib/buildMapContentsParams';
import { getMapContents, getMapContentsQueryKey, type MapContentsLocation } from '@shared/api/mapContents';
import { useCurrentCoords } from '@entities/location';
import { toClusteredPlaceLocation, toPlaceLocation, type ClusteredPlaceLocation, type PlaceLocation } from './types';

type UseMapLocationsParams = {
  bounds: Bounds | null;
  center: Coordinates;
  isClustered: boolean;
  /** treasure 모드처럼 장소 마커 자체가 필요 없는 화면에서 요청을 아예 막는다 */
  enabled?: boolean;
};

// GET /api/v2/map/contents 중 locations만 쓰는 쪽 — roadGuestbooks는 entities/guestbook의 useRoadGuestbooks가
// 같은 파라미터로 독립 호출한다. queryKey(=params)가 같으면 TanStack Query가 캐시를 공유해 실제 요청은 한 번만 나간다.
export function useMapLocations(params: UseMapLocationsParams & { isClustered: true }): { locations: ClusteredPlaceLocation[]; isLoading: boolean; isError: boolean };
export function useMapLocations(params: UseMapLocationsParams & { isClustered: false }): { locations: PlaceLocation[]; isLoading: boolean; isError: boolean };
export function useMapLocations({ bounds, center, isClustered, enabled = true }: UseMapLocationsParams) {
  const queryEnabled = enabled && bounds !== null;
  const userCoords = useCurrentCoords() ?? center;
  const requestParams = bounds ? buildMapContentsParams(bounds, userCoords, isClustered) : buildMapContentsParams({ sw: center, ne: center }, userCoords, isClustered);

  const query = useQuery({
    queryKey: getMapContentsQueryKey(requestParams),
    queryFn: ({ signal }) => getMapContents(requestParams, signal),
    enabled: queryEnabled,
    // 조회 실패를 지도 화면 전체 오류로 올리지 않고 마커가 그냥 안 보이는 정도로 흡수한다.
    throwOnError: false,
    // bounds/tier가 바뀌어 쿼리키가 바뀌는 순간 data가 undefined로 비면서 마커가 전부 사라졌다 다시
    // 채워지는 깜빡임이 있었다. 새 응답이 올 때까지 이전 화면의 데이터를 그대로 보여줘 없앤다.
    placeholderData: keepPreviousData,
  });

  const locations = useMemo(() => {
    if (!query.data) return [];
    return isClustered
      ? (query.data.locations as GeneratedApi.ClusteredLocationResponse[]).map(toClusteredPlaceLocation)
      : (query.data.locations as MapContentsLocation[]).map(toPlaceLocation);
  }, [query.data, isClustered]);

  return { locations, isLoading: query.isLoading, isError: query.isError };
}
