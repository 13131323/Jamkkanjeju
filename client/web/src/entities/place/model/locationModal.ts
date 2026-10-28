'use client';

import type { GeneratedApi } from '@packages/shared';
import type { Coordinates } from '@shared/config/geo';
import { useGetMapModalApiV1MapModalsGet } from '@/services/api/map/map';
import type { MapMissionType } from './types';

export type LocationModalMission = {
  missionId: number;
  missionType: MapMissionType;
  missionTitle: string;
  isCompleted: boolean;
  rewardDetail: GeneratedApi.FullRewardDetailResponse;
};

export type LocationModalGuestbookEntry = {
  id: number;
  missionTitle: string | null;
  representativeImageUrl: string | null;
  userNickname: string;
  characterImgUrl: string | null;
  visitedAt: string;
  contentWriting: string | null;
};

export type LocationModalData = {
  id: number;
  locationTitle: string;
  locationCategory: string;
  distanceMeter: number;
  durationMinutes: number;
  isVisited: boolean;
  mission: LocationModalMission | null;
  guestbooksCount: number;
  guestbooks: LocationModalGuestbookEntry[];
};

function toLocationModalData(response: GeneratedApi.LocationModalResponse): LocationModalData {
  return {
    id: response.id,
    locationTitle: response.locationTitle,
    locationCategory: response.locationCategory,
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

// GET /api/v1/map/modals?targetType=LOCATION — 장소 마커(미션 있음/없음 공통) 클릭 시 모달에 쓴다.
export function useLocationModal(locationId: number | null, center: Coordinates) {
  const query = useGetMapModalApiV1MapModalsGet(
    { targetType: 'LOCATION', targetId: locationId ?? 0, userLatitude: center.lat, userLongitude: center.lng },
    { query: { enabled: locationId !== null, throwOnError: false } },
  );

  const data = query.data && 'locationTitle' in query.data ? toLocationModalData(query.data as GeneratedApi.LocationModalResponse) : undefined;

  return { data, isLoading: query.isLoading, isError: query.isError };
}
