'use client';

import { useMemo } from 'react';
import { useMapLocations, useTiledPlaceLocations, type ClusteredPlaceLocation, type PlaceLocation } from '@entities/place';
import { distanceMeters, JEJU_CENTER, JEJU_ISLAND_BOUNDS, type Bounds, type Coordinates } from '@shared/config/geo';
import type { PlaceFilter } from '@features/place-filter';
import type { MapZoomTier } from './useMapZoomTier';

export type PlaceGroup = {
  key: string;
  coords: Coordinates;
  count: number;
};

// wideSplit 티어 전용: 보물찾기/협동미션 장소를 각각 위치 기준으로 클러스터링한 결과.
export type PlaceCluster = {
  key: string;
  coords: Coordinates;
  count: number;
  missionType: 'treasure' | 'coop';
};

export type PlaceGroupResult =
  | { tier: 'wide'; groups: PlaceGroup[]; isLoading: boolean }
  | { tier: 'wideSplit'; clusters: PlaceCluster[]; isLoading: boolean }
  | { tier: 'detail'; places: PlaceLocation[]; isLoading: boolean };

// 근처 장소끼리 거리 기준으로 묶는다. 임의로 설정한 값 — 실기기 확인 후 조정 가능.
const PLACE_CLUSTER_DISTANCE_METERS = 1000;

function centroid(coordsList: Coordinates[]): Coordinates {
  const sum = coordsList.reduce((acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / coordsList.length, lng: sum.lng / coordsList.length };
}

// 단순 그리디 클러스터링: 기존 클러스터 중심에서 임계 거리 이내면 합류(합류 시 중심 재계산), 아니면 새 클러스터 생성
function clusterByDistance<T extends { coords: Coordinates }>(items: T[], keyPrefix: string): { key: string; coords: Coordinates; count: number }[] {
  const clusters: { coords: Coordinates; members: T[] }[] = [];

  for (const item of items) {
    const nearby = clusters.find((cluster) => distanceMeters(cluster.coords, item.coords) <= PLACE_CLUSTER_DISTANCE_METERS);
    if (nearby) {
      nearby.members.push(item);
      nearby.coords = centroid(nearby.members.map((member) => member.coords));
    } else {
      clusters.push({ coords: item.coords, members: [item] });
    }
  }

  return clusters.map((cluster, index) => ({ key: `${keyPrefix}-${index}`, coords: cluster.coords, count: cluster.members.length }));
}

function missionTypeOf(location: ClusteredPlaceLocation | PlaceLocation): 'treasure' | 'coop' | null {
  const type = 'mission' in location ? (location.mission?.type ?? null) : location.missionType;
  if (type === 'TREASURE') return 'treasure';
  if (type === 'COOPERATIVE') return 'coop';
  return null;
}

// 미션 없는 장소는 필터(보물찾기/협동미션) 대상이 아니라 항상 보여야 한다 — detail 티어에서 늘 노출.
function matchesFilter(location: ClusteredPlaceLocation | PlaceLocation, filter: PlaceFilter): boolean {
  if (filter === 'all') return true;
  const type = missionTypeOf(location);
  if (type === null) return true;
  return type === filter;
}

// wide: 미션 있는 장소를 위치 기준으로 뭉뚱그린 원마커(좌표만 아는 클러스터 응답)
// wideSplit: 보물찾기/협동미션 각각 위치 기준 클러스터 — 클러스터링에 필요한 건 좌표+미션유형뿐이고
// 둘 다 클러스터 응답(isClustered=true)에도 있어서, wide와 같은 가벼운 응답을 쓴다(상세 응답 불필요).
// detail: 개별 장소(상세 응답 그대로 — 사진·거리 등 개별 마커 표시에 필요한 값이라 여기만 상세 응답을 쓴다)
//
// clusteredResult는 bounds/center를 뷰포트가 아니라 제주 전역 고정값(JEJU_ISLAND_BOUNDS/JEJU_CENTER)으로
// 요청한다 — 서버가 isClustered=true 응답엔 사용자 좌표를 아예 안 써서(거리·시간 계산을 생략) 고정값을
// 넣어도 손실이 없고, 팬/줌으로 쿼리키가 바뀌지 않아 한 번 받으면 그대로 캐시가 재사용된다
// (useCouponLocationCoords.ts가 쿠폰 사용처 조회에 이미 쓰던 것과 같은 패턴).
// detailResult는 개별 장소가 너무 많아 전역을 한 번에 받을 수 없어서, 고정 타일 격자로 캐싱한다
// (useTiledPlaceLocations.ts 참고).
export function usePlaceGroups(bounds: Bounds | null, filter: PlaceFilter, tier: MapZoomTier, enabled: boolean): PlaceGroupResult {
  const isDetailTier = tier === 'detail';

  const clusteredResult = useMapLocations({ bounds: JEJU_ISLAND_BOUNDS, center: JEJU_CENTER, isClustered: true, enabled: enabled && !isDetailTier });
  const detailResult = useTiledPlaceLocations(bounds, enabled && isDetailTier);

  return useMemo(() => {
    if (tier === 'detail') {
      const places = detailResult.locations.filter((place) => matchesFilter(place, filter));
      return { tier: 'detail', places, isLoading: detailResult.isLoading };
    }

    if (tier === 'wideSplit') {
      const withMission = clusteredResult.locations.filter((location) => location.missionType !== null && matchesFilter(location, filter));
      const treasure = withMission.filter((location) => location.missionType === 'TREASURE');
      const coop = withMission.filter((location) => location.missionType === 'COOPERATIVE');

      const clusters: PlaceCluster[] = [
        ...clusterByDistance(treasure, 'treasure-cluster').map((cluster) => ({ ...cluster, missionType: 'treasure' as const })),
        ...clusterByDistance(coop, 'coop-cluster').map((cluster) => ({ ...cluster, missionType: 'coop' as const })),
      ];

      return { tier: 'wideSplit', clusters, isLoading: clusteredResult.isLoading };
    }

    const withMission = clusteredResult.locations.filter((location) => location.missionType !== null && matchesFilter(location, filter));
    const groups = clusterByDistance(withMission, 'wide-cluster');

    return { tier: 'wide', groups, isLoading: clusteredResult.isLoading };
  }, [tier, filter, clusteredResult.locations, clusteredResult.isLoading, detailResult.locations, detailResult.isLoading]);
}
