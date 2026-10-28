import type { GeneratedApi } from '@packages/shared';
import type { Coordinates } from '@shared/config/geo';

export type { Coordinates };

export type MapMissionType = Extract<GeneratedApi.AppMissionModelsMissionType, 'TREASURE' | 'COOPERATIVE'>;

// GET /api/v1/map/contents(isClustered=false) 응답의 location 하나 — 개별 마커(detail 티어)에서 쓴다.
// treasureMission/cooperativeMission 중 있는 쪽 하나를 mission으로 정규화한다(한 장소엔 미션이 최대 하나).
export type PlaceLocation = {
  id: number;
  coords: Coordinates;
  locationTitle: string;
  distanceMeter: number;
  durationMinutes: number;
  mission: PlaceLocationMission | null;
  guestbooksCount: number;
  representativeImageUrl: string | null;
};

export type PlaceLocationMission = {
  type: MapMissionType;
  id: number;
  missionTitle: string;
  isCompleted: boolean;
  hasWrittenGuestbook: boolean | null;
};

// GET /api/v1/map/contents(isClustered=true) 응답의 location 하나 — wide 티어에서 좌표·미션유형만으로 클러스터링한다.
export type ClusteredPlaceLocation = {
  id: number;
  coords: Coordinates;
  missionId: number | null;
  missionType: MapMissionType | null;
};

function toMission(mission: GeneratedApi.MapMissionResponse | null | undefined, type: MapMissionType): PlaceLocationMission | null {
  if (!mission) return null;
  return {
    type,
    id: mission.id,
    missionTitle: mission.missionTitle,
    isCompleted: mission.isCompleted,
    hasWrittenGuestbook: mission.hasWrittenGuestbook ?? null,
  };
}

export function toPlaceLocation(location: GeneratedApi.MapLocationResponse): PlaceLocation {
  return {
    id: location.id,
    coords: { lat: location.latitude, lng: location.longitude },
    locationTitle: location.locationTitle,
    distanceMeter: location.distanceMeter,
    durationMinutes: location.durationMinutes,
    mission: toMission(location.treasureMission, 'TREASURE') ?? toMission(location.cooperativeMission, 'COOPERATIVE'),
    guestbooksCount: location.guestbooksCount ?? 0,
    representativeImageUrl: location.representativeImageUrl ?? null,
  };
}

export function toClusteredPlaceLocation(location: GeneratedApi.ClusteredLocationResponse): ClusteredPlaceLocation {
  return {
    id: location.id,
    coords: { lat: location.latitude, lng: location.longitude },
    missionId: location.missionId ?? null,
    missionType: (location.missionType as MapMissionType | null | undefined) ?? null,
  };
}
