'use client';

import type { GeneratedApi } from '@packages/shared';
import type { Coordinates } from '@shared/config/geo';
import { useGetMapModalApiV1MapModalsGet } from '@/services/api/map/map';

export type RoadGuestbookModalData = {
  id: number;
  userNickname: string;
  locationAlias: string;
  distanceMeter: number;
  durationMinutes: number;
  visitedAt: string; // ISO 8601
  contentImageUrls: string[] | null;
  contentWriting: string | null;
  contentAudioUrls: string[] | null;
  contentWeather: string | null;
  contentColorCode: string | null;
};

function toRoadGuestbookModalData(response: GeneratedApi.RoadGuestbookModalResponse): RoadGuestbookModalData {
  return {
    id: response.id,
    userNickname: response.userNickname,
    locationAlias: response.locationAlias,
    distanceMeter: response.distanceMeter,
    durationMinutes: response.durationMinutes,
    visitedAt: response.visitedAt,
    contentImageUrls: response.contentImageUrls ?? null,
    contentWriting: response.contentWriting ?? null,
    contentAudioUrls: response.contentAudioUrls ?? null,
    contentWeather: response.contentWeather ?? null,
    contentColorCode: response.contentColorCode ?? null,
  };
}

// GET /api/v1/map/modals?targetType=ROAD_GUESTBOOK — 길바닥 방명록 마커 클릭 시 모달에 쓴다.
export function useRoadGuestbookModal(guestbookId: number | null, center: Coordinates) {
  const query = useGetMapModalApiV1MapModalsGet(
    { targetType: 'ROAD_GUESTBOOK', targetId: guestbookId ?? 0, userLatitude: center.lat, userLongitude: center.lng },
    { query: { enabled: guestbookId !== null, throwOnError: false } },
  );

  const data = query.data && 'locationAlias' in query.data ? toRoadGuestbookModalData(query.data as GeneratedApi.RoadGuestbookModalResponse) : undefined;

  return { data, isLoading: query.isLoading, isError: query.isError };
}
