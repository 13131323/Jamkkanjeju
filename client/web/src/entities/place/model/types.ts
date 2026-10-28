import type { GeneratedApi } from '@packages/shared';
import type { Coordinates } from '@shared/config/geo';
import type { MapContentsLocation } from '@shared/api/mapContents';

export type { Coordinates };

export type MapMissionType = Extract<GeneratedApi.AppMissionModelsMissionType, 'TREASURE' | 'COOPERATIVE'>;

// GET /api/v2/map/contents(isClustered=false) 응답의 location 하나 — 개별 마커(detail 티어)에서 쓴다.
// 서버의 단일 mission 필드를 지도 마커가 사용하는 형태로 변환한다.
export type PlaceLocation = {
  id: number;
  coords: Coordinates;
  locationTitle: string;
  distanceMeter: number;
  durationMinutes: number;
  mission: PlaceLocationMission | null;
  guestbooksCount: number;
  representativeImageUrl: string | null;
  receivedCoupons: PlaceReceivedCoupon[];
};

// GET /api/v2/map/contents에서 해당 장소에 연결된 현재 사용자의 수령 쿠폰이다.
export type PlaceReceivedCoupon = {
  couponPrice: number;
  locationAddress: string;
};

export type PlaceLocationMission = {
  type: MapMissionType;
  id: number;
  missionTitle: string;
  isCompleted: boolean;
  hasWrittenGuestbook: boolean | null;
};

// GET /api/v2/map/contents(isClustered=true) 응답의 location 하나 — wide 티어에서 좌표·미션유형만으로 클러스터링한다.
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

export function toPlaceLocation(location: MapContentsLocation): PlaceLocation {
  return {
    id: location.id,
    coords: { lat: location.latitude, lng: location.longitude },
    locationTitle: location.locationTitle,
    distanceMeter: location.distanceMeter,
    durationMinutes: location.durationMinutes,
    mission: location.mission ? toMission(location.mission, location.mission.missionType) : null,
    guestbooksCount: location.guestbooksCount ?? 0,
    representativeImageUrl: location.representativeImageUrl ?? null,
    receivedCoupons: (location.receivedCoupons ?? []).map((coupon) => ({ couponPrice: coupon.couponPrice, locationAddress: coupon.locationAddress })),
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
