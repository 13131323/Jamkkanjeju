'use client';

import { useEffect, useState } from 'react';
import type { Bounds } from '@shared/config/geo';

function toBounds(kakaoBounds: kakao.maps.LatLngBounds): Bounds {
  const sw = kakaoBounds.getSouthWest();
  const ne = kakaoBounds.getNorthEast();
  return { sw: { lat: sw.getLat(), lng: sw.getLng() }, ne: { lat: ne.getLat(), lng: ne.getLng() } };
}

// 드래그/줌이 끝나고 지도가 멈췄을 때('idle')만 bounds를 갱신한다 — 과도한 API 호출 방지
export function useMapBounds(map: kakao.maps.Map | null): Bounds | null {
  const [bounds, setBounds] = useState<Bounds | null>(null);

  useEffect(() => {
    if (!map) return;

    // 지도가 만들어진 뒤에야 bounds를 읽을 수 있어 useState 초기값으로 옮길 수 없다.
    // 'idle' 구독 전에 현재 값을 한 번 맞춰두는, 외부 시스템 동기화의 seed다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBounds(toBounds(map.getBounds()));

    const handleIdle = () => setBounds(toBounds(map.getBounds()));

    window.kakao.maps.event.addListener(map, 'idle', handleIdle);
    return () => {
      window.kakao.maps.event.removeListener(map, 'idle', handleIdle);
    };
  }, [map]);

  return bounds;
}
