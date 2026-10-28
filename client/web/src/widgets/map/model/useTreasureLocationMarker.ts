'use client';

import { useEffect, useRef } from 'react';
import homeMyLocationIcon from '@shared/lib/images/home_my_location_icon.png';
import { createTreasureLocationElement, TREASURE_LOCATION_MARKER_Z_INDEX } from './markerElements';
import type { TreasureLocationPoint } from './useTreasureLocationBridge';

/**
 * 마커 원 안에 들어가는 캐릭터.
 *
 * 홈(UserLocationMarker)과 지도(useUserLocationMarker)가 쓰는 것과 **같은 에셋**이다 —
 * 같은 "내 위치"를 세 화면에서 서로 다른 그림으로 보여주면 같은 것으로 읽히지 않는다.
 * 보물찾기 전용이던 treasure-user-avatar.png는 그래서 더 쓰지 않는다.
 *
 * 홈은 사용자 캐릭터(characterImgUrl)가 있으면 그걸 먼저 쓰고 이 에셋을 폴백으로 둔다.
 * 이 마커도 같은 값을 받으려면 브릿지나 홈 조회로 URL이 들어와야 해서, 지금은 폴백만 쓴다.
 */
const defaultAvatarSrc = homeMyLocationIcon.src;

/**
 * 보물찾기(TreasureHunt) step1 지도의 현재 위치 마커.
 * kakao.maps.CustomOverlay를 좌표에 그대로 바인딩하므로, 지도를 팬/줌해도
 * 마커가 실제 좌표에 붙어 있다 — 화면 중앙 고정(기각된 대안 B)과 다르다
 * (docs/trouble/2026-08-15-treasure-hunt-tech-decisions.md §4).
 *
 * point가 null이면(브릿지로부터 아직 좌표를 받지 못했거나 mode≠treasure) 마커를 그리지 않는다.
 */
export function useTreasureLocationMarker(map: kakao.maps.Map | null, point: TreasureLocationPoint | null) {
  const overlayRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const setHeadingRef = useRef<((headingDeg: number | null) => void) | null>(null);
  /**
   * 첫 좌표가 들어왔을 때 한 번만 지도를 내 위치로 옮긴다.
   *
   * 보물 마커 훅이 장소 좌표로 먼저 중심을 잡아 두는데, 사용자가 그 장소에서 수백 m 떨어져 있으면
   * 내 마커가 화면 밖에 남아 보이지 않는다. 이후에는 사용자가 팬한 화면을 덮지 않도록 다시 옮기지 않는다.
   */
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    if (!map) return;

    if (!point) {
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
      setHeadingRef.current = null;
      return;
    }

    const position = new window.kakao.maps.LatLng(point.lat, point.lng);

    if (overlayRef.current) {
      overlayRef.current.setPosition(position);
      setHeadingRef.current?.(point.heading);
    } else {
      const { el, setHeading } = createTreasureLocationElement(point.heading, defaultAvatarSrc);
      setHeadingRef.current = setHeading;

      const overlay = new window.kakao.maps.CustomOverlay({
        position,
        content: el,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: TREASURE_LOCATION_MARKER_Z_INDEX,
      });
      overlay.setMap(map);
      overlayRef.current = overlay;
    }

    if (!hasCenteredRef.current) {
      hasCenteredRef.current = true;
      map.setCenter(position);
    }
  }, [map, point]);

  useEffect(() => {
    return () => {
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
    };
  }, []);
}
