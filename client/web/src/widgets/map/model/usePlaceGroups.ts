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

// receivedCoupons는 detail 응답(PlaceLocation)에만 있다 — wide/wideSplit이 쓰는 클러스터 응답
// (ClusteredPlaceLocation)엔 필드 자체가 없어 항상 false다.
function hasReceivedCoupons(location: ClusteredPlaceLocation | PlaceLocation): boolean {
  return 'receivedCoupons' in location && location.receivedCoupons.length > 0;
}

// 선택한 미션 유형의 장소 또는 획득 쿠폰이 있는 장소만 표시한다.
function matchesFilter(location: ClusteredPlaceLocation | PlaceLocation, filter: PlaceFilter): boolean {
  if (filter === 'coupon') return hasReceivedCoupons(location);
  if (filter === 'all') return true;
  const type = missionTypeOf(location);
  return type === filter;
}

// detail(1~5) 안에서 줌아웃할수록 미션 없는 장소를 줄여서 보여준다. id 기반 무작위 표본은 좌표를 전혀
// 고려하지 않아 우연히 가까운 장소끼리 같이 살아남아 마커가 겹쳐 보이는 문제가 있었다 — 그래서 좌표 기반
// 최소 거리 필터링(그리디 thinning)으로 대체한다: 살아남은 장소끼리는 항상 최소 거리 이상 떨어지도록 보장한다.
// 정확한 비율(70%/50%/30%)은 더 이상 보장되지 않는다(밀집 지역일수록 더 많이 걸러지고, 외딴 장소는 그대로
// 남음) — 대신 "겹쳐 보이지 않는다"는 실제 요구사항을 직접 만족시킨다.
//
// 레벨 3/4/5로 갈수록 최소 거리를 늘리되, 각 단계는 이전 단계의 생존자만 대상으로 추가 필터링한다.
// 그래야 레벨5 결과가 항상 레벨4 결과의 부분집합, 레벨4는 레벨3의 부분집합이 되어(예: 레벨5에서 보이는
// 장소는 레벨3에서도 항상 보임) 줌 인/아웃 시 장소가 오락가락 나타나지 않는다(이전 요구사항 유지).
// 값은 임의로 설정한 것 — 실기기 확인 후 조정 가능(PLACE_CLUSTER_DISTANCE_METERS와 동일한 성격).
const NO_MISSION_MIN_DISTANCE_METERS: [level: number, meters: number][] = [
  [3, 80],
  [4, 150],
  [5, 250],
];

// 이미 선택된 장소들과 최소 거리보다 가까운 장소를 걸러낸다. 앞에 오는 항목이 우선권을 갖는 그리디 방식이라,
// 입력 순서(=id 오름차순, 아래 sampleNoMissionPlacesAt 참고)가 항상 같아야 결과가 결정적이다.
function thinByMinDistance<T extends { coords: Coordinates }>(places: T[], minDistanceMeters: number): T[] {
  const kept: T[] = [];
  for (const place of places) {
    const tooClose = kept.some((keptPlace) => distanceMeters(keptPlace.coords, place.coords) < minDistanceMeters);
    if (!tooClose) kept.push(place);
  }
  return kept;
}

function sampleNoMissionPlacesAt(places: PlaceLocation[], level: number): PlaceLocation[] {
  let survivors = [...places].sort((a, b) => a.id - b.id);
  for (const [stageLevel, minDistanceMeters] of NO_MISSION_MIN_DISTANCE_METERS) {
    if (level < stageLevel) break;
    survivors = thinByMinDistance(survivors, minDistanceMeters);
  }
  return survivors;
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
export function usePlaceGroups(bounds: Bounds | null, filter: PlaceFilter, tier: MapZoomTier, level: number, enabled: boolean): PlaceGroupResult {
  const isDetailTier = tier === 'detail';

  const clusteredResult = useMapLocations({ bounds: JEJU_ISLAND_BOUNDS, center: JEJU_CENTER, isClustered: true, enabled: enabled && !isDetailTier });
  const detailResult = useTiledPlaceLocations(bounds, enabled && isDetailTier);

  return useMemo(() => {
    if (tier === 'detail') {
      const filtered = detailResult.locations.filter((place) => matchesFilter(place, filter));
      // 쿠폰 사용처는 "가야 할 가게를 찍어주는" 화면이라 미션 없는 장소처럼 줄여 보여주면(thinning)
      // 안 된다 — 항상 전부 그린다. 미션이 있어도 쿠폰이 있으면 이 갈래로 빠져 마커 하나만 그려진다
      // (usePlaceMarkers가 쿠폰 마커를 우선하므로 중복 마커는 생기지 않는다).
      const withCoupon = filtered.filter((place) => place.receivedCoupons.length > 0);
      const withoutCoupon = filtered.filter((place) => place.receivedCoupons.length === 0);
      const withMission = withoutCoupon.filter((place) => place.mission !== null);
      const withoutMission = withoutCoupon.filter((place) => place.mission === null);
      const places = [...withCoupon, ...withMission, ...sampleNoMissionPlacesAt(withoutMission, level)];
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
  }, [tier, filter, level, clusteredResult.locations, clusteredResult.isLoading, detailResult.locations, detailResult.isLoading]);
}
