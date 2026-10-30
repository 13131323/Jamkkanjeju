'use client';

import { useQuery } from '@tanstack/react-query';
import type { Coordinates } from '@shared/config/geo';
import { getMapModal, getMapModalQueryKey, type LocationMapModalResponse, type MapModalParams, type MapModalRewardDetail } from '@shared/api/mapModal';
import type { MapMissionType } from './types';

export type LocationModalMission = {
  missionId: number;
  missionType: MapMissionType;
  missionTitle: string;
  isCompleted: boolean;
  rewardDetail: MapModalRewardDetail;
};

export type LocationModalGuestbookEntry = {
  id: number;
  missionTitle: string | null;
  representativeImageUrl: string | null;
  userNickname: string | null;
  characterImgUrl: string | null;
  visitedAt: string;
  contentWriting: string | null;
};

export type LocationModalData = {
  id: number;
  locationTitle: string;
  locationCategory: string;
  representativeImageUrl: string | null;
  distanceMeter: number;
  durationMinutes: number;
  isVisited: boolean;
  mission: LocationModalMission | null;
  guestbooksCount: number;
  guestbooks: LocationModalGuestbookEntry[];
};

function toLocationModalData(response: LocationMapModalResponse): LocationModalData {
  return {
    id: response.id,
    locationTitle: response.locationTitle,
    locationCategory: response.locationCategory,
    representativeImageUrl: response.representativeImageUrl,
    distanceMeter: response.distanceMeter,
    durationMinutes: response.durationMinutes,
    isVisited: response.isVisited,
    mission: response.mission
      ? {
          missionId: response.mission.missionId,
          missionType: response.mission.missionType as MapMissionType,
          missionTitle: response.mission.missionTitle,
          isCompleted: response.mission.isCompleted,
          rewardDetail: response.mission.rewardDetail,
        }
      : null,
    guestbooksCount: response.guestbooksCount ?? 0,
    guestbooks: response.guestbooks.map((entry) => ({
      id: entry.id,
      missionTitle: entry.missionTitle ?? null,
      representativeImageUrl: entry.representativeImageUrl ?? null,
      userNickname: entry.userNickname,
      characterImgUrl: entry.characterImgUrl ?? null,
      visitedAt: entry.visitedAt,
      contentWriting: entry.contentWriting ?? null,
    })),
  };
}

// GET /api/v2/map/modals?targetType=LOCATION — 장소·미션 모달이 동일한 응답을 사용한다.
export function useLocationModal(locationId: number | null, center: Coordinates) {
  const params: MapModalParams = { targetType: 'LOCATION', targetId: locationId ?? 0, userLatitude: center.lat, userLongitude: center.lng };
  const query = useQuery({
    queryKey: getMapModalQueryKey(params),
    queryFn: ({ signal }) => getMapModal(params, signal),
    enabled: locationId !== null,
    throwOnError: false,
  });
  const data = query.data && 'locationTitle' in query.data ? toLocationModalData(query.data) : undefined;
  return { data, isLoading: query.isLoading, isError: query.isError };
}
