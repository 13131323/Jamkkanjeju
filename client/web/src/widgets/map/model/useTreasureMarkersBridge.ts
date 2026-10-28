'use client';

import { useEffect, useState } from 'react';
import { listenFromApp } from '@shared/lib/bridge/utils';

export type TreasureMarkerPoint = {
  treasureId: string;
  order: number;
  lat: number;
  lng: number;
  found: boolean;
};

export type TreasureMarkersState = {
  /** 지도 초기 중심(장소 좌표). 앱이 안 보내면 null */
  center: { lat: number; lng: number } | null;
  treasures: TreasureMarkerPoint[];
};

const EMPTY: TreasureMarkersState = { center: null, treasures: [] };

/**
 * 앱이 보내는 TREASURE_MARKERS_UPDATE를 구독해 보물 마커 목록을 반환한다.
 * enabled가 false면(mode=treasure가 아니면) 구독하지 않고 빈 목록을 반환한다.
 *
 * 보물 좌표는 앱의 mock 상수에 있고(app/src/constants/treasureHunt.ts) 반경 판정도 앱이 한다.
 * web은 "받은 좌표를 지도에 그리는" 역할만 맡는다 — 현재 위치 마커와 같은 분담이다.
 */
export function useTreasureMarkersBridge(enabled: boolean): TreasureMarkersState {
  const [state, setState] = useState<TreasureMarkersState>(EMPTY);

  useEffect(() => {
    if (!enabled) return;

    return listenFromApp((message) => {
      if (message.type !== 'TREASURE_MARKERS_UPDATE') return;

      const { center, treasures } = message.payload;
      setState({
        center: center ? { lat: center.latitude, lng: center.longitude } : null,
        treasures: treasures.map((treasure) => ({
          treasureId: treasure.treasureId,
          order: treasure.order,
          lat: treasure.latitude,
          lng: treasure.longitude,
          found: treasure.found,
        })),
      });
    });
  }, [enabled]);

  return enabled ? state : EMPTY;
}
