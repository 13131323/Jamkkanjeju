'use client';

import { useEffect } from 'react';
import { useLocationStore } from '@entities/location';
import type { Coordinates } from '@shared/config/geo';

/**
 * `?lat=&lng=`로 들어온 좌표를 위치 스토어에 심는다.
 *
 * 새 WebView로 `/map`을 직접 여는 진입(앱의 "더보기" 등)은 위치 스토어를 채우는 쪽이 없다 —
 * LOCATION_UPDATE를 구독하는 곳은 HomePage의 useLocationBridge 하나뿐이고, 그 페이지는
 * 이 WebView에 뜨지 않는다. 그대로 두면 지도는 제주 중심·레벨 9에서 열리고 거리 계산의 기준점도
 * 제주 중심이 되어 "근처"가 근처가 아니게 된다.
 *
 * 새 상태를 만들지 않고 스토어의 manualCoords에 넣는다 — resolveDisplayLocation이 이미
 * "실시간 좌표가 없으면 수동 좌표"로 읽고, 앱이 넘긴 좌표는 실제로 사용자의 현재 위치다.
 * 이후 브릿지로 실시간 좌표가 들어오면 그쪽이 이긴다(같은 함수의 우선순위 그대로).
 *
 * 호출 위치가 중요하다: 지도 인스턴스를 만드는 useKakaoMap이 스토어를 **effect 안에서 한 번**
 * 읽으므로, 이 훅을 그보다 먼저 호출해 같은 커밋에서 먼저 심어야 진입 레벨·중심이 좌표를 반영한다.
 */
export function useEntryCoords(coords: Coordinates | null) {
  const setManualCoords = useLocationStore((state) => state.setManualCoords);

  useEffect(() => {
    if (!coords) return;
    setManualCoords(coords);
  }, [coords, setManualCoords]);
}
