'use client';

import { useMemo } from 'react';
import { keepPreviousData, useQueries } from '@tanstack/react-query';
import type { GeneratedApi } from '@packages/shared';
import { boundsContains, centerOf, surroundingTileIds, tileBoundsOf, tileCenterOf, type Bounds } from '@shared/config/geo';
import { buildMapContentsParams } from '@shared/lib/buildMapContentsParams';
import { getGetMapContentsApiV1MapContentsGetQueryKey, getMapContentsApiV1MapContentsGet } from '@/services/api/map/map';
import type { RoadGuestbookMarker } from './types';

function toRoadGuestbookMarker(guestbook: GeneratedApi.MapRoadGuestbookResponse): RoadGuestbookMarker {
  return {
    id: guestbook.id,
    coords: { lat: guestbook.latitude, lng: guestbook.longitude },
    locationAlias: guestbook.locationAlias,
    representativeImageUrl: guestbook.representativeGuestbookImageUrl ?? null,
  };
}

// GET /api/v1/map/contents 중 roadGuestbooks만 쓰는 쪽 — locations는 entities/place의 useTiledPlaceLocations가
// 정확히 같은 고정 타일(bounds/center) 파라미터로 독립 호출한다. queryKey가 같으면 TanStack Query가
// 캐시를 공유해 실제 네트워크 요청은 한 번만 나간다(장소 마커 쪽 9개 타일 요청에 그대로 얹혀간다) —
// 예전에는 여기만 라이브 뷰포트로 따로 불러서, 이미 타일로 받아둔 지역을 또 한 번 조회하고 있었다.
// 방명록 마커는 detail 티어(isClustered=false)에서만 쓰인다.
export function useRoadGuestbooks({ bounds, enabled }: { bounds: Bounds | null; enabled: boolean }): { guestbooks: RoadGuestbookMarker[]; isLoading: boolean } {
  const tiles = bounds ? surroundingTileIds(centerOf(bounds)) : [];

  const results = useQueries({
    queries: tiles.map((tile) => {
      const params = buildMapContentsParams(tileBoundsOf(tile), tileCenterOf(tile), false);
      return {
        queryKey: getGetMapContentsApiV1MapContentsGetQueryKey(params),
        queryFn: ({ signal }: { signal: AbortSignal }) => getMapContentsApiV1MapContentsGet(params, undefined, signal),
        enabled,
        throwOnError: false,
        placeholderData: keepPreviousData,
      };
    }),
  });

  return useMemo(() => {
    // 타일 경계선 위 방명록은 서버의 viewport 판정이 경계 포함이라 인접 타일 양쪽에 다 걸릴 수 있다 —
    // id 기준으로 한 번만 남긴다(useTiledPlaceLocations와 동일한 이유·동일한 방식).
    const merged = new Map<number, RoadGuestbookMarker>();
    for (const result of results) {
      const data = result.data as { roadGuestbooks: GeneratedApi.MapRoadGuestbookResponse[] } | undefined;
      if (!data) continue;
      for (const raw of data.roadGuestbooks) {
        const guestbook = toRoadGuestbookMarker(raw);
        merged.set(guestbook.id, guestbook);
      }
    }

    // 9칸(3x3)을 전부 받아오지만, 실제로 화면에 보여줄 건 지금 뷰포트 안뿐이라 마지막에 한 번 더 거른다.
    const guestbooks = bounds ? [...merged.values()].filter((guestbook) => boundsContains(bounds, guestbook.coords)) : [];

    return { guestbooks, isLoading: results.some((result) => result.isLoading) };
  }, [results, bounds]);
}
