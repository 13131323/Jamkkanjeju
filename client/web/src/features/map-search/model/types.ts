import type { MapSearchMission } from '@shared/api/mapSearch';

export type SearchResultPlace = {
  id: number;
  name: string;
  categoryLabel: string;
  distanceLabel: string;
  representativeImageUrl: string | null;
  mission: MapSearchMission | null;
};

export type SearchResponse = {
  locations: SearchResultPlace[];
};
