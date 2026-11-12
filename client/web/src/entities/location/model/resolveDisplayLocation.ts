import { useMemo } from 'react';
import type { LocationPermissionStatus } from '@shared/lib/bridge';
import { JEJU_ISLAND_BOUNDS, type Coordinates } from '@shared/config/geo';
import { useLocationStore } from './store';
export type DisplayLocation = { coords: Coordinates | null; initialLevel: number };
export function isOutsideJeju(coords: Coordinates): boolean {
  return coords.lat < JEJU_ISLAND_BOUNDS.sw.lat || coords.lat > JEJU_ISLAND_BOUNDS.ne.lat || coords.lng < JEJU_ISLAND_BOUNDS.sw.lng || coords.lng > JEJU_ISLAND_BOUNDS.ne.lng;
}
export function resolveDisplayLocation(permission: LocationPermissionStatus, live: Coordinates | null, manual: Coordinates | null): DisplayLocation {
  const granted = permission === 'granted-precise' || permission === 'granted-approximate';
  if (granted && live && !isOutsideJeju(live)) return { coords: live, initialLevel: 5 };
  return manual ? { coords: manual, initialLevel: 5 } : { coords: null, initialLevel: 9 };
}
export function useDisplayLocation(): DisplayLocation {
  const permission = useLocationStore((s) => s.permissionStatus);
  const coords = useLocationStore((s) => s.coords);
  const manual = useLocationStore((s) => s.manualCoords);
  return useMemo(() => resolveDisplayLocation(permission, coords, manual), [permission, coords, manual]);
}
