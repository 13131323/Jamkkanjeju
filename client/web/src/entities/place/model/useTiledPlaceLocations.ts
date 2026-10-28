'use client';

import { useMemo } from 'react';
import { keepPreviousData, useQueries } from '@tanstack/react-query';
import { boundsContains, centerOf, surroundingTileIds, tileBoundsOf, tileCenterOf, type Bounds } from '@shared/config/geo';
import { buildMapContentsParams } from '@shared/lib/buildMapContentsParams';
import { getMapContents, getMapContentsQueryKey, type MapContentsLocation } from '@shared/api/mapContents';
import { useCurrentCoords } from '@entities/location';
import { toPlaceLocation, type PlaceLocation } from './types';

// isClustered=false(개별 장소 상세) 조회를 뷰포트가 아니라 고정 타일(placeTileGrid.ts) 단위로 캐싱한다.
// 뷰포트 중심이 속한 타일을 중앙으로 3x3(9칸)을 각각 독립된 쿼리로 요청 — 타일 하나하나가 TanStack
// Query에 별도로 캐싱되므로, 화면이 이미 받아둔 9칸 안에서만 움직이면 재요청이 없고, 벗어나면 그
// 방향의 새 타일만 요청된다(나머지는 캐시에서 그대로 재사용). useQueries를 쓰는 이유는 쿼리 개수가
// 배열 기반이라 useQuery를 반복 호출하는 것보다 Rules of Hooks에 안전하기 때문이다.
export function useTiledPlaceLocations(bounds: Bounds | null, enabled: boolean): { locations: PlaceLocation[]; isLoading: boolean } {
  const tiles = bounds ? surroundingTileIds(centerOf(bounds)) : [];
  const userCoords = useCurrentCoords();

  const results = useQueries({
    queries: tiles.map((tile) => {
      const params = buildMapContentsParams(tileBoundsOf(tile), userCoords ?? tileCenterOf(tile), false);
      return {
        queryKey: getMapContentsQueryKey(params),
        queryFn: ({ signal }: { signal: AbortSignal }) => getMapContents(params, signal),
        enabled,
        throwOnError: false,
        placeholderData: keepPreviousData,
      };
    }),
  });

  return useMemo(() => {
    // 타일 경계선 위 장소는 서버의 viewport 판정이 경계 포함이라 인접 타일 양쪽에 다 걸릴 수 있다 —
    // id 기준으로 한 번만 남긴다(경계를 겹치지 않게 나누는 것보다 훨씬 단순하고 확실하다).
    const merged = new Map<number, PlaceLocation>();
    for (const result of results) {
      const data = result.data as { locations: MapContentsLocation[] } | undefined;
      if (!data) continue;
      for (const raw of data.locations) {
        const location = toPlaceLocation(raw);
        merged.set(location.id, location);
      }
    }

    // 9칸(3x3)을 전부 받아오지만, 실제로 화면에 보여줄 건 지금 뷰포트 안뿐이라 마지막에 한 번 더 거른다.
    const locations = bounds ? [...merged.values()].filter((location) => boundsContains(bounds, location.coords)) : [];

    return { locations, isLoading: results.some((result) => result.isLoading) };
  }, [results, bounds]);
}
