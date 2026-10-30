import { orvalClient } from './axios/instance';

export type MapSearchMission = { missionId: number; missionType: 'TREASURE' | 'COOPERATIVE'; missionTitle: string };
export type MapSearchResponse = {
  locations: { locationId: number; locationTitle: string; locationCategory: string; representativeImageUrl: string | null; distanceMeter: number; mission: MapSearchMission | null }[];
  locationsPage: { page: number; size: number; hasNext: boolean };
};
export type MapSearchParams = { keyword: string; userLatitude: number; userLongitude: number; page: number; size: number };

/** v2 장소 이름 포함 검색을 페이지 단위로 조회한다. */
export function searchMapLocations(params: MapSearchParams, signal?: AbortSignal) {
  return orvalClient<MapSearchResponse>({ url: '/api/v2/map/search', method: 'GET', params, signal });
}
