import type { GeneratedApi } from '@packages/shared';
import { orvalClient } from './axios/instance';

/** v2 지도 모달의 선택 대상과 사용자 좌표이다. */
export type MapModalParams = { targetType: 'LOCATION' | 'ROAD_GUESTBOOK'; targetId: number; userLatitude: number; userLongitude: number };
export type MapModalRewardDetail = Omit<GeneratedApi.FullRewardDetailResponse, 'coupon'> & {
  coupon?: (Omit<NonNullable<GeneratedApi.FullRewardDetailResponse['coupon']>, 'couponLocation'> & { couponLocation: string | null }) | null;
};
export type LocationMapModalResponse = Omit<GeneratedApi.LocationModalResponse, 'mission' | 'guestbooks'> & {
  representativeImageUrl: string | null;
  mission: (Omit<NonNullable<GeneratedApi.LocationModalResponse['mission']>, 'rewardDetail'> & { rewardDetail: MapModalRewardDetail }) | null;
  guestbooks: (Omit<GeneratedApi.LocationModalResponse['guestbooks'][number], 'userNickname'> & { userId: number | null; userNickname: string | null })[];
};
export type RoadMapModalResponse = Omit<GeneratedApi.RoadGuestbookModalResponse, 'userNickname' | 'contentImageUrls' | 'contentAudioUrls'> & {
  userNickname: string | null;
  characterImgUrl: string | null;
  contentImageUrl: string | null;
  contentAudioUrl: string | null;
};
export type MapModalResponse = LocationMapModalResponse | RoadMapModalResponse;

/** 동일 장소 모달은 일반·미션·쿠폰 전환에서 요청과 캐시를 공유한다. */
export function getMapModalQueryKey(params: MapModalParams) { return ['/api/v2/map/modals', params] as const; }

/** 선택 대상에 따라 장소 또는 길바닥 방명록 모달 데이터를 조회한다. */
export function getMapModal(params: MapModalParams, signal?: AbortSignal) {
  return orvalClient<MapModalResponse>({ url: '/api/v2/map/modals', method: 'GET', params, signal });
}
