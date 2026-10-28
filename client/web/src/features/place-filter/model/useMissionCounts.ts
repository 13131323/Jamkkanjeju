'use client';

import { useMapLocations, useTiledPlaceLocations, type ClusteredPlaceLocation, type PlaceLocation } from '@entities/place';
import { boundsContains, JEJU_CENTER, JEJU_ISLAND_BOUNDS, type Bounds } from '@shared/config/geo';

function missionTypeOf(location: ClusteredPlaceLocation | PlaceLocation): 'treasure' | 'coop' | null {
  const type = 'mission' in location ? (location.mission?.type ?? null) : location.missionType;
  if (type === 'TREASURE') return 'treasure';
  if (type === 'COOPERATIVE') return 'coop';
  return null;
}

// PlaceFilterChips 배지 카운트와 FilteredMissionModalCard 오픈 여부 판단(개수 0이면 열지 않음)이 같은 기준을 쓰도록 공용 훅으로 뺐다.
// isClustered는 현재 지도 줌 티어가 요청 중인 값과 맞춰서 넘긴다 — usePlaceMarkers/usePlaceGroups가 이미
// 불러온 캐시를 그대로 재사용하기 위함(TanStack Query가 동일 queryKey를 공유한다). 두 훅을 항상 같이
// 호출하고 enabled로만 실제 요청 여부를 가른다(Rules of Hooks).
//
// clustered는 usePlaceGroups.ts와 동일하게 bounds/center를 제주 전역 고정값으로 요청한다(캐시 공유).
// 배지는 "현재 화면 안 개수만" 세야 하므로(기존 제품 규칙), 전역 응답을 받은 뒤 boundsContains로
// 현재 뷰포트 기준으로 다시 걸러낸다.
export function useMissionCounts(bounds: Bounds | null, isClustered: boolean): Record<'treasure' | 'coop', number> {
  const clustered = useMapLocations({ bounds: JEJU_ISLAND_BOUNDS, center: JEJU_CENTER, isClustered: true, enabled: isClustered });
  const detailed = useTiledPlaceLocations(bounds, !isClustered);

  const inViewClustered = bounds ? clustered.locations.filter((location) => boundsContains(bounds, location.coords)) : [];
  const locations: (ClusteredPlaceLocation | PlaceLocation)[] = isClustered ? inViewClustered : detailed.locations;

  return {
    treasure: locations.filter((location) => missionTypeOf(location) === 'treasure').length,
    coop: locations.filter((location) => missionTypeOf(location) === 'coop').length,
  };
}
