import type { Coordinates } from '@shared/config/geo';

export type { Bounds } from '@shared/config/geo';

// GET /api/v2/map/contents(isClustered=false) 응답의 roadGuestbook 하나 — 개별 마커(detail 티어)에서 쓴다.
export type RoadGuestbookMarker = {
  id: number;
  coords: Coordinates;
  locationAlias: string;
  representativeImageUrl: string | null;
};
