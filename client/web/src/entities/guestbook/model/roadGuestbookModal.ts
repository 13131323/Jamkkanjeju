'use client';

import { useQuery } from '@tanstack/react-query';
import type { Coordinates } from '@shared/config/geo';
import { getMapModal, getMapModalQueryKey, type RoadMapModalResponse, type MapModalParams } from '@shared/api/mapModal';

export type RoadGuestbookModalData = {
  id: number;
  userNickname: string | null;
  characterImgUrl: string | null;
  locationAlias: string;
  distanceMeter: number;
  durationMinutes: number;
  visitedAt: string; // ISO 8601
  contentImageUrl: string | null;
  contentWriting: string | null;
  contentAudioUrl: string | null;
  contentWeather: string | null;
  contentColorCode: string | null;
};

function toRoadGuestbookModalData(response: RoadMapModalResponse): RoadGuestbookModalData {
  return {
    id: response.id,
    userNickname: response.userNickname,
    characterImgUrl: response.characterImgUrl ?? null,
    locationAlias: response.locationAlias,
    distanceMeter: response.distanceMeter,
    durationMinutes: response.durationMinutes,
    visitedAt: response.visitedAt,
    contentImageUrl: response.contentImageUrl ?? null,
    contentWriting: response.contentWriting ?? null,
    contentAudioUrl: response.contentAudioUrl ?? null,
    contentWeather: response.contentWeather ?? null,
    contentColorCode: response.contentColorCode ?? null,
  };
}

// GET /api/v2/map/modals?targetType=ROAD_GUESTBOOK — 단일 첨부 URL을 받는다.
export function useRoadGuestbookModal(guestbookId: number | null, center: Coordinates) {
  const params: MapModalParams = { targetType: 'ROAD_GUESTBOOK', targetId: guestbookId ?? 0, userLatitude: center.lat, userLongitude: center.lng };
  const query = useQuery({
    queryKey: getMapModalQueryKey(params),
    queryFn: ({ signal }) => getMapModal(params, signal),
    enabled: guestbookId !== null,
    throwOnError: false,
  });
  const data = query.data && 'locationAlias' in query.data ? toRoadGuestbookModalData(query.data) : undefined;
  return { data, isLoading: query.isLoading, isError: query.isError };
}
