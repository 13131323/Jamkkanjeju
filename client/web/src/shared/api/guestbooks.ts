import type { GeneratedApi } from '@packages/shared';
import { orvalClient } from './axios/instance';

type GuestbookContent = { userId: number | null; userNickname: string | null; contentImageUrl: string | null; contentAudioUrl: string | null; contentTemperatureCelsius: number | null };
export type GeneralGuestbook = Omit<GeneratedApi.GeneralGuestbookResponse, 'userId' | 'userNickname' | 'contentImageUrls' | 'contentAudioUrls'> & GuestbookContent;
export type RoadGuestbook = Omit<GeneratedApi.RoadGuestbookResponse, 'userId' | 'userNickname' | 'contentImageUrls' | 'contentAudioUrls'> & GuestbookContent;
export type GuestbooksPage = { page: number; size: number; hasNext: boolean };
export type GuestbooksResponse = {
  visitedLocations: GeneratedApi.VisitedLocationSummaryResponse[];
  generalGuestbooks: GeneralGuestbook[];
  roadGuestbooks: RoadGuestbook[];
  generalGuestbooksPage: GuestbooksPage;
  roadGuestbooksPage: GuestbooksPage;
};
export type GuestbookTypeFilter = 'ALL' | 'GENERAL' | 'ROAD';
export type GuestbookSort = 'LATEST' | 'POPULAR' | 'MINE' | 'LIKED';
export type GuestbookFilters = { guestbookType: GuestbookTypeFilter; sort: GuestbookSort };
export const DEFAULT_GUESTBOOK_FILTERS: GuestbookFilters = { guestbookType: 'ALL', sort: 'LATEST' };
export type GuestbooksParams = GuestbookFilters & { generalPage: number; generalSize: number; roadPage: number; roadSize: number };
export const GUESTBOOKS_QUERY_KEY = ['/api/v2/guestbooks'] as const;

export type GuestbookLikeResponse = { guestbookId: number; isLiked: boolean; likeCount: number };

/** 공통 방명록 ID로 좋아요를 반전하고 서버가 확정한 상태를 반환한다. */
export function toggleGuestbookLike(guestbookId: number) {
  return orvalClient<GuestbookLikeResponse>({ url: `/api/v2/guestbooks/${guestbookId}/like`, method: 'POST' });
}

/** 일반·길바닥 방명록을 각각 지정한 페이지와 크기로 조회한다. */
export function getGuestbooks(params: GuestbooksParams, signal?: AbortSignal) {
  return orvalClient<GuestbooksResponse>({ url: '/api/v2/guestbooks', method: 'GET', params, signal });
}
