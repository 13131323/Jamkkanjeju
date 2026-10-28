'use client';

import { useEffect, useState } from 'react';
import { listenFromApp } from '@shared/lib/bridge/utils';

export type TreasureLocationPoint = {
  lat: number;
  lng: number;
  /** 앱의 trueHeading 무효값(-1)은 여기서 null로 정규화된다 — null이면 방향 삼각형을 그리지 않는다 */
  heading: number | null;
};

/** app이 보낸 trueHeading 무효값. docs/trouble/2026-08-15-treasure-hunt-tech-decisions.md §4 */
const INVALID_HEADING = -1;

/**
 * 브릿지로 들어오는 TREASURE_LOCATION_UPDATE 메시지를 구독해 최신 좌표/heading을 반환한다.
 * enabled가 false면(mode=treasure가 아니면) 구독하지 않고 항상 null을 반환한다.
 */
export function useTreasureLocationBridge(enabled: boolean): TreasureLocationPoint | null {
  const [point, setPoint] = useState<TreasureLocationPoint | null>(null);

  useEffect(() => {
    if (!enabled) return;

    return listenFromApp((message) => {
      if (message.type !== 'TREASURE_LOCATION_UPDATE') return;

      const { latitude, longitude, heading } = message.payload;
      setPoint({
        lat: latitude,
        lng: longitude,
        heading: heading === INVALID_HEADING ? null : heading,
      });
    });
  }, [enabled]);

  return enabled ? point : null;
}
