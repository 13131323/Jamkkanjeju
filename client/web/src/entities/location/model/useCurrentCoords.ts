import { useMemo } from 'react';
import type { LocationPermissionStatus } from '@shared/lib/bridge';
import type { Coordinates } from '@shared/config/geo';
import { useLocationStore } from './store';
/** 저장된 센서 좌표는 이미 로그인 역할에 따른 변환이 반영되어 있다. */
export function resolveCurrentCoords(permissionStatus: LocationPermissionStatus, liveCoords: Coordinates | null, manualCoords: Coordinates | null): Coordinates | null {
  const granted = permissionStatus === 'granted-precise' || permissionStatus === 'granted-approximate';
  return granted && liveCoords ? liveCoords : manualCoords;
}
export function useCurrentCoords(): Coordinates | null {
  const permission = useLocationStore((s) => s.permissionStatus);
  const coords = useLocationStore((s) => s.coords);
  const manual = useLocationStore((s) => s.manualCoords);
  return useMemo(() => resolveCurrentCoords(permission, coords, manual), [permission, coords, manual]);
}
