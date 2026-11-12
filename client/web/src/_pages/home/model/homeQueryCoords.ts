import { JEJU_CENTER, type Coordinates } from '@shared/config/geo';

export function resolveHomeQueryCoords(currentCoords: Coordinates | null): Coordinates {
  if (currentCoords === null) return JEJU_CENTER;
  return { lat: roundCoord(currentCoords.lat), lng: roundCoord(currentCoords.lng) };
}

function roundCoord(value: number): number {
  return Math.round(value * 10000) / 10000;
}
