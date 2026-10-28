'use client';

import { useEffect, useRef } from 'react';
import iconTreasureAsset from '@shared/lib/images/icon-mission-treasure.png';
import closedChestAsset from '@shared/lib/images/treasure-chest-closed.png';
import openChestAsset from '@shared/lib/images/treasure-chest-open.png';
import type { Coordinates } from '@shared/config/geo';
import { sendToApp } from '@shared/lib/bridge/utils';
import { createTreasureMarkerElement, createTreasurePinElement, TREASURE_MARKER_Z_INDEX, type TreasureMarkerElement, type TreasurePinElement } from './markerElements';
import { resolveTreasureCluster, resolveTreasureMarkerMode, type TreasureMarkerMode } from './treasureMarkerLayout';
import { DETAIL_ENTRY_LEVEL, type MapZoomTier } from './useMapZoomTier';
import type { TreasureMarkersState } from './useTreasureMarkersBridge';

const closedChestSrc = closedChestAsset.src;
const openChestSrc = openChestAsset.src;
/** 개별 마커의 "아직 못 찾음" 아이콘 — 지도 화면이 보물찾기 장소에 쓰는 것과 같은 아이콘 */
const iconTreasureSrc = iconTreasureAsset.src;

type ClusterEntry = {
  overlay: kakao.maps.CustomOverlay;
  element: TreasureMarkerElement;
  found: boolean;
  badgeLabel: string | null;
};

type PinEntry = {
  overlay: kakao.maps.CustomOverlay;
  element: TreasurePinElement;
  found: boolean;
  /** TREASURE_MARKER_PRESS로 되돌려 보낼 보물 번호. 리스너가 이 객체를 참조하므로 갱신하면 최신값이 나간다 */
  order: number;
};

/**
 * 보물찾기 step1 지도의 보물 마커 — 줌 레벨에 따라 형태가 바뀐다.
 *
 * - 축소(wideSplit 6~7 / wide 8~9): 장소를 대표하는 마커 1개 + 남은 개수 배지
 *   (Penpot TreasureHunt_step1 "Group 113"). 누르면 지도 화면의 클러스터 탭과 똑같이
 *   그 좌표로 이동하며 DETAIL_ENTRY_LEVEL(5)까지 확대한다.
 * - 확대(detail 1~5): 보물마다 자기 좌표에 개별 마커. 지도 화면의 보물미션 아이콘 마커를 그대로 쓴다.
 *   누르면 앱에 TREASURE_MARKER_PRESS를 보낸다 — 손으로 끌어내려 닫은 step1 시트를 다시 여는 유일한 경로다.
 *
 * 티어 경계는 useMapZoomTier의 levelToTier를 그대로 쓴다(새 임계값을 만들지 않는다).
 *
 * kakao.maps.CustomOverlay를 좌표에 바인딩해 지도를 팬/줌해도 마커가 실제 좌표에 붙어 있게 한다
 * (현재 위치 마커 useTreasureLocationMarker와 같은 방식).
 *
 * 마커를 매 업데이트마다 새로 만들지 않고 재사용한다 — 앱이 위치 갱신과 함께 목록을 다시 보내도
 * 마커가 깜빡이지 않아야 한다. 다시 만드는 것은 형태(mode)가 실제로 바뀔 때뿐이다.
 */
export function useTreasureMarkers(map: kakao.maps.Map | null, state: TreasureMarkersState, tier: MapZoomTier, onClusterClick: (coords: Coordinates, targetLevel: number) => void) {
  const clusterRef = useRef<ClusterEntry | null>(null);
  const pinsRef = useRef<Map<string, PinEntry>>(new Map());
  /** 현재 그려져 있는 형태. 여기가 바뀔 때만 오버레이를 걷어내고 다시 만든다 */
  const modeRef = useRef<TreasureMarkerMode | null>(null);
  /**
   * 대표 마커 클릭 리스너가 읽을 최신값. 리스너는 마커를 만들 때 한 번만 붙이므로,
   * 좌표나 콜백이 바뀌었다고 마커를 다시 만들지 않게 ref로 건네준다.
   */
  const clusterCoordsRef = useRef<Coordinates | null>(null);
  const onClusterClickRef = useRef(onClusterClick);
  /** 첫 메시지의 center로만 한 번 지도를 옮긴다. 이후에는 사용자 팬을 덮지 않는다 */
  const hasCenteredRef = useRef(false);

  // 렌더 중에 ref를 쓰면 안 되므로(react-hooks) 콜백 최신값 보관은 별도 effect로 한다.
  useEffect(() => {
    onClusterClickRef.current = onClusterClick;
  }, [onClusterClick]);

  useEffect(() => {
    if (!map) return;

    const pins = pinsRef.current;

    function clearCluster() {
      clusterRef.current?.overlay.setMap(null);
      clusterRef.current = null;
    }

    function clearPins() {
      for (const pin of pins.values()) pin.overlay.setMap(null);
      pins.clear();
    }

    const mode = resolveTreasureMarkerMode(tier);
    // 형태가 바뀌면 다른 종류의 엘리먼트가 필요해 재사용이 불가능하다. 반대편 오버레이를 남기지 않고 걷어낸다.
    if (modeRef.current !== mode) {
      modeRef.current = mode;
      clearCluster();
      clearPins();
    }

    if (mode === 'clustered') {
      const cluster = resolveTreasureCluster(state);
      if (!cluster) {
        clearCluster();
      } else {
        clusterCoordsRef.current = cluster.coords;
        const position = new window.kakao.maps.LatLng(cluster.coords.lat, cluster.coords.lng);
        const existing = clusterRef.current;

        if (existing) {
          existing.overlay.setPosition(position);
          // 에셋·배지 교체는 실제로 바뀔 때만 — 매번 img.src를 쓰면 브라우저가 다시 디코딩한다
          if (existing.found !== cluster.allFound) {
            existing.element.setFound(cluster.allFound);
            existing.found = cluster.allFound;
          }
          if (existing.badgeLabel !== cluster.badgeLabel) {
            existing.element.setBadgeLabel(cluster.badgeLabel);
            existing.badgeLabel = cluster.badgeLabel;
          }
        } else {
          const element = createTreasureMarkerElement({
            badgeLabel: cluster.badgeLabel,
            closedImageSrc: closedChestSrc,
            openImageSrc: openChestSrc,
            found: cluster.allFound,
          });
          // 지도 화면의 wideSplit 클러스터 탭과 같은 동작 — 그 좌표로 옮기고 detail 진입 레벨까지 확대한다
          // (usePlaceMarkers의 onClusterClick(cluster.coords, DETAIL_ENTRY_LEVEL)).
          // 여러 보물을 대표하는 마커라 TREASURE_MARKER_PRESS(보물 번호 1개)는 보내지 않는다.
          element.el.addEventListener('click', () => {
            const coords = clusterCoordsRef.current;
            if (coords) onClusterClickRef.current(coords, DETAIL_ENTRY_LEVEL);
          });

          const overlay = new window.kakao.maps.CustomOverlay({
            position,
            content: element.el,
            xAnchor: 0.5,
            yAnchor: 0.5,
            zIndex: TREASURE_MARKER_Z_INDEX,
          });
          overlay.setMap(map);
          clusterRef.current = { overlay, element, found: cluster.allFound, badgeLabel: cluster.badgeLabel };
        }
      }
    } else {
      const nextIds = new Set(state.treasures.map((treasure) => treasure.treasureId));

      // 목록에서 빠진 마커를 걷어낸다
      for (const [treasureId, pin] of pins) {
        if (!nextIds.has(treasureId)) {
          pin.overlay.setMap(null);
          pins.delete(treasureId);
        }
      }

      for (const treasure of state.treasures) {
        const position = new window.kakao.maps.LatLng(treasure.lat, treasure.lng);
        const existing = pins.get(treasure.treasureId);

        if (existing) {
          existing.overlay.setPosition(position);
          existing.order = treasure.order;
          if (existing.found !== treasure.found) {
            existing.element.setFound(treasure.found);
            existing.found = treasure.found;
          }
          continue;
        }

        // 못 찾은 보물은 지도 화면과 같은 보물미션 아이콘, 찾은 보물은 디자인의 열린 상자 에셋.
        // 디자인이 정한 찾음 표시는 "열린 상자"뿐이라, 반투명·회색조 같은 새 처리를 만들지 않고 그것을 쓴다.
        const element = createTreasurePinElement({
          closedImageSrc: iconTreasureSrc,
          openImageSrc: openChestSrc,
          found: treasure.found,
        });

        const overlay = new window.kakao.maps.CustomOverlay({
          position,
          content: element.el,
          xAnchor: 0.5,
          // 대표 마커와 같은 중심 정렬. 지도 화면의 detail 마커는 이름 라벨이 아래에 붙어 yAnchor 1이지만,
          // 여기서는 원 하나뿐이라 중심이 곧 보물 좌표여야 하고(useTreasureLocationMarker와 같은 이유)
          // 축소↔확대로 바뀔 때 마커가 위아래로 튀지 않는다.
          yAnchor: 0.5,
          zIndex: TREASURE_MARKER_Z_INDEX,
        });
        overlay.setMap(map);

        const pin: PinEntry = { overlay, element, found: treasure.found, order: treasure.order };
        // 앱의 step1 시트는 끌어내려 닫으면 반경 안에 있어도 다시 안 열린다. 이 탭이 다시 여는 신호다.
        // treasureIndex는 숫자여야 한다(zod int positive) — 문자열 treasureId가 아니라 order를 그대로 보낸다.
        // 배지에 쓰는 3 상한(TREASURE_MARKER_BADGE_MAX)은 표시용이라 여기엔 적용하지 않는다.
        element.el.addEventListener('click', () => {
          sendToApp({ type: 'TREASURE_MARKER_PRESS', payload: { treasureIndex: pin.order } });
        });
        pins.set(treasure.treasureId, pin);
      }
    }

    if (state.center && !hasCenteredRef.current) {
      hasCenteredRef.current = true;
      map.setCenter(new window.kakao.maps.LatLng(state.center.lat, state.center.lng));
    }
  }, [map, state, tier]);

  // 화면을 떠날 때 남은 오버레이를 모두 지운다
  useEffect(() => {
    const pins = pinsRef.current;
    return () => {
      clusterRef.current?.overlay.setMap(null);
      clusterRef.current = null;
      for (const pin of pins.values()) pin.overlay.setMap(null);
      pins.clear();
      modeRef.current = null;
    };
  }, []);
}
