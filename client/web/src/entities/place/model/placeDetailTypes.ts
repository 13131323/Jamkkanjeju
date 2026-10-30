import type { MapLocationDetailResponse, MapLocationMission } from '@shared/api/mapLocationDetail';
import type { MapModalRewardDetail } from '@shared/api/mapModal';
import type { MapMissionType } from './types';

export type PlaceDetailMission = {
  missionId: number;
  missionType: MapMissionType;
  missionTitle: string;
  description: string | null;
  isCompleted: boolean;
  rewardDetail: MapModalRewardDetail;
};

export type PlaceNearbyMission = PlaceDetailMission & {
  locationTitle: string;
  representativeImageUrl: string | null;
};

export type PlaceReview = {
  id: number;
  missionTitle: string | null;
  representativeImageUrl: string | null;
  userId: number | null;
  userNickname: string | null;
  characterImgUrl: string | null;
  visitedAt: string;
  contentWriting: string | null;
};

export type PlaceDetail = {
  locationTitle: string;
  locationCategory: string;
  distanceMeter: number;
  durationMinutes: number;
  locationAddress: string;
  isVisited: boolean;
  // TourAPI에서 오는 부가 정보라 조회에 실패하면 null로 온다.
  description: string | null;
  imageUrls: string[];
  nearbyMissions: PlaceNearbyMission[];
  reviews: PlaceReview[];
  locationMission: PlaceDetailMission | null;
};

function toMission(mission: MapLocationMission): PlaceDetailMission {
  return {
    missionId: mission.missionId,
    missionType: mission.missionType as MapMissionType,
    missionTitle: mission.missionTitle,
    description: mission.description ?? null,
    isCompleted: mission.isCompleted,
    rewardDetail: mission.rewardDetail,
  };
}

export function toPlaceDetail(response: MapLocationDetailResponse): PlaceDetail {
  return {
    locationTitle: response.locationTitle,
    locationCategory: response.locationCategory,
    distanceMeter: response.distanceMeter,
    durationMinutes: response.durationMinutes,
    locationAddress: response.locationAddress,
    isVisited: response.isVisited,
    description: response.locationDescription ?? null,
    imageUrls: response.locationImageUrls ?? [],
    nearbyMissions: response.nearbyMissions.map((mission) => ({
      ...toMission(mission),
      locationTitle: mission.locationTitle,
      representativeImageUrl: mission.representativeImageUrl ?? null,
    })),
    reviews: response.guestbooks.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      missionTitle: entry.missionTitle ?? null,
      representativeImageUrl: entry.representativeImageUrl ?? null,
      userNickname: entry.userNickname,
      characterImgUrl: entry.characterImgUrl ?? null,
      visitedAt: entry.visitedAt,
      contentWriting: entry.contentWriting ?? null,
    })),
    locationMission: response.locationMission ? toMission(response.locationMission) : null,
  };
}
