import type { GeneratedApi } from '@packages/shared';
import { orvalClient } from './axios/instance';
import type { MapModalRewardDetail, LocationMapModalResponse } from './mapModal';

export type MapLocationDetailParams = { userLatitude: number; userLongitude: number; page: number; size: number };
export type MapLocationMission = Omit<GeneratedApi.LocationMissionResponse, 'rewardDetail'> & { rewardDetail: MapModalRewardDetail };
export type MapLocationDetailResponse = Omit<GeneratedApi.LocationDetailResponse, 'guestbooks' | 'nearbyMissions' | 'locationMission'> & {
  guestbooks: LocationMapModalResponse['guestbooks'];
  guestbooksPage: { page: number; size: number; hasNext: boolean };
  nearbyMissions: (MapLocationMission & { locationTitle: string; representativeImageUrl: string | null })[];
  locationMission: MapLocationMission | null;
};

/** 사용자 좌표와 방명록 페이지 조건으로 v2 장소 상세 정보를 조회한다. */
export function getMapLocationDetail(locationId: number, params: MapLocationDetailParams, signal?: AbortSignal) {
  return orvalClient<MapLocationDetailResponse>({ url: `/api/v2/map/locations/${locationId}`, method: 'GET', params, signal });
}
