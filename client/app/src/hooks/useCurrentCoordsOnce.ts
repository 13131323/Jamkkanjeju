import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { applyAdminPosition } from '@/store/adminLocation';
export interface LatLng {
  lat: number;
  lng: number;
}
/** 실측 좌표를 한 번 읽고 관리자일 때만 좌표 차이를 반영한다. */
export function useCurrentCoordsOnce(enabled: boolean): LatLng | null {
  const [coords, setCoords] = useState<LatLng | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void (async () => {
      try {
        const p = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        const c = applyAdminPosition(p.coords);
        if (active) setCoords({ lat: c.latitude, lng: c.longitude });
      } catch {
        /* 권한·측위 실패 시 좌표를 만들지 않는다. */
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled]);
  return coords;
}
