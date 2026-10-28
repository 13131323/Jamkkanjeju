'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useLocationStore, resolveDisplayLocation, forcedJejuCoords } from '@entities/location';
import { JEJU_CENTER } from '@shared/config/geo';
import { useKakaoMapsSdk } from '@shared/lib/kakaoMaps/loadKakaoMapsSdk';

/**
 * @param initialLevelOverride 진입 줌 레벨을 강제한다. 보물찾기 step1처럼 화면이 특정 티어에서
 *   시작해야 하는 경우에만 넘긴다 — 생략하면 위치 상태로 계산한 기본값을 쓴다.
 */
export function useKakaoMap(containerRef: RefObject<HTMLDivElement | null>, initialLevelOverride?: number) {
  const { loaded, error } = useKakaoMapsSdk();
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const [map, setMap] = useState<kakao.maps.Map | null>(null);

  useEffect(() => {
    if (!loaded || !containerRef.current || mapRef.current) return;

    // 최초 렌더링 시점의 위치 상태로 center/level을 한 번만 계산한다 (15지도phase2필요.md).
    // 이후 상태 변화는 이 map 인스턴스가 만들어진 뒤 다른 훅(useUserLocationMarker 등)이 반응형으로 처리한다.
    const { permissionStatus, coords, manualCoords } = useLocationStore.getState();
    // 마커(useDisplayLocation)와 같은 폴백을 봐야 제주 고정 모드에서 중심과 마커가 어긋나지 않는다
    const { coords: displayCoords, initialLevel } = resolveDisplayLocation(permissionStatus, coords, manualCoords, forcedJejuCoords());
    const center = displayCoords ?? JEJU_CENTER;

    const instance = new window.kakao.maps.Map(containerRef.current, {
      center: new window.kakao.maps.LatLng(center.lat, center.lng),
      level: initialLevelOverride ?? initialLevel,
    });

    mapRef.current = instance;
    setMap(instance);
  }, [loaded, containerRef, initialLevelOverride]);

  return { map, loaded, error };
}
