'use client';

import { useEffect, useRef } from 'react';
import iconCollaborationAsset from '@shared/lib/images/icon-mission-collaboration.png';
import iconTreasureAsset from '@shared/lib/images/icon-mission-treasure.png';
import type { PlaceFilter } from '@features/place-filter';
import type { PlaceLocationMission } from '@entities/place';
import type { Bounds, Coordinates } from '@shared/config/geo';
import { createClusterElement, createContentPinElement, createPlaceMarkerElement, type ClusterColorScheme } from './markerElements';
import { DETAIL_ENTRY_LEVEL, WIDE_SPLIT_ENTRY_LEVEL, type MapZoomTier } from './useMapZoomTier';
import { usePlaceGroups } from './usePlaceGroups';

const iconTreasureSrc = iconTreasureAsset.src;
const iconCollaborationSrc = iconCollaborationAsset.src;

// 로컬장소 마커는 방명록 마커보다 항상 위에 보이도록 z-index를 높게 둔다 (17지도phase2추가수정.md)
const PLACE_MARKER_Z_INDEX = 10;

// 원마커 클릭 시 확대해서 진입할 목표 레벨(WIDE_SPLIT_ENTRY_LEVEL / DETAIL_ENTRY_LEVEL)은
// 티어 경계와 같은 곳에서 관리한다 — useMapZoomTier.ts 참고.

// 원마커 크기: 6~7은 176px 고정, 8은 132px, 9는 88px — 줌아웃할수록 자연스럽게 작아지도록 (19지도phase3 이후 요청사항)
function clusterSize(level: number): number {
  if (level <= 7) return 176;
  if (level === 8) return 132;
  return 88;
}

// wide 티어(8~9) 원마커 색상: 필터가 'all'이면 primary, 필터로 미션 종류가 고정되면 그 미션 색상을 그대로 사용
function wideColorScheme(filter: PlaceFilter): ClusterColorScheme {
  if (filter === 'treasure') return 'tertiary';
  if (filter === 'coop') return 'sunny-yellow';
  return 'primary';
}

// 보물찾기/협동미션은 미션별 아이콘, 미션 없는 장소는 빈 아이콘 자리 (17지도phase2추가수정.md)
function missionIconSrc(mission: PlaceLocationMission | null): string | undefined {
  if (mission?.type === 'TREASURE') return iconTreasureSrc;
  if (mission?.type === 'COOPERATIVE') return iconCollaborationSrc;
  return undefined;
}

export type PlaceMarkerHandlers = {
  // 개별 마커(detail 티어) 중 미션 있는 장소 클릭 시 map_contents-modal
  onMissionClick: (locationId: number) => void;
  // 개별 마커 중 미션 없는 장소 클릭 시 map_place-modal (20지도phase3-map-modal.md)
  onPlaceClick: (locationId: number) => void;
  // 대분류 원마커(wide/wideSplit) 클릭 시 그 좌표로 이동하며 한 단계 확대(줌인)한다.
  onClusterClick: (coords: Coordinates, targetLevel: number) => void;
};

// 줌 단계·필터가 바뀔 때마다 기존 오버레이를 전부 지우고 다시 그린다.
export function usePlaceMarkers(
  map: kakao.maps.Map | null,
  bounds: Bounds | null,
  filter: PlaceFilter,
  tier: MapZoomTier,
  level: number,
  handlers: PlaceMarkerHandlers,
) {
  const result = usePlaceGroups(bounds, filter, tier, map !== null);
  const overlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);
  // handlers는 매 렌더 새 객체로 들어올 수 있어, effect 의존성은 그 안의 (안정적인) 함수 참조 자체를 사용한다.
  const { onMissionClick, onPlaceClick, onClusterClick } = handlers;

  useEffect(() => {
    if (!map) return;

    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    const newOverlays: kakao.maps.CustomOverlay[] = [];

    if (result.tier === 'wide') {
      const size = clusterSize(level);
      const colorScheme = wideColorScheme(filter);

      for (const group of result.groups) {
        const el = createClusterElement(group.count, undefined, size, colorScheme);
        el.addEventListener('click', () => {
          onClusterClick(group.coords, WIDE_SPLIT_ENTRY_LEVEL);
        });

        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(group.coords.lat, group.coords.lng),
          content: el,
          xAnchor: 0.5,
          yAnchor: 0.5,
          zIndex: PLACE_MARKER_Z_INDEX,
        });
        overlay.setMap(map);
        newOverlays.push(overlay);
      }
    } else if (result.tier === 'wideSplit') {
      const size = clusterSize(level);

      for (const cluster of result.clusters) {
        const colorScheme = cluster.missionType === 'treasure' ? 'tertiary' : 'sunny-yellow';
        const el = createClusterElement(cluster.count, undefined, size, colorScheme);
        el.addEventListener('click', () => {
          onClusterClick(cluster.coords, DETAIL_ENTRY_LEVEL);
        });

        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(cluster.coords.lat, cluster.coords.lng),
          content: el,
          xAnchor: 0.5,
          yAnchor: 0.5,
          zIndex: PLACE_MARKER_Z_INDEX,
        });
        overlay.setMap(map);
        newOverlays.push(overlay);
      }
    } else {
      for (const place of result.places) {
        // 보물찾기/협동미션은 ContentPinMarker(미션별 아이콘), 미션 없는 장소는 클러스터링된 방명록 마커와 동일한
        // PlaceMarker 형태(사진박스+카운트배지+이름라벨)를 쓴다.
        const el =
          place.mission === null
            ? createPlaceMarkerElement(place.locationTitle, place.guestbooksCount, place.representativeImageUrl ?? undefined)
            : createContentPinElement(missionIconSrc(place.mission));

        el.addEventListener('click', () => {
          if (place.mission === null) {
            onPlaceClick(place.id);
          } else {
            onMissionClick(place.id);
          }
        });

        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(place.coords.lat, place.coords.lng),
          content: el,
          xAnchor: 0.5,
          yAnchor: 1,
          zIndex: PLACE_MARKER_Z_INDEX,
        });
        overlay.setMap(map);
        newOverlays.push(overlay);
      }
    }

    overlaysRef.current = newOverlays;
  }, [map, result, filter, level, onMissionClick, onPlaceClick, onClusterClick]);

  useEffect(() => {
    return () => {
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
    };
  }, []);
}
