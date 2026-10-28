import type { GeneratedApi } from '@packages/shared';
import { orvalClient } from './axios/instance';

/** Spring v2 지도 홈의 화면 두 꼭짓점·사용자 좌표와 응답 구분이다. */
export type MapContentsParams = {
  leftTopLatitude: number;
  leftTopLongitude: number;
  rightBottomLatitude: number;
  rightBottomLongitude: number;
  userLatitude: number;
  userLongitude: number;
  isClustered: boolean;
};

/** 장소에 연결된 단일 활성 미션. ID는 공통 MISSION.id다. */
export type MapContentsMission = GeneratedApi.MapMissionResponse & { missionType: 'TREASURE' | 'COOPERATIVE' };
export type MapContentsLocation = Omit<GeneratedApi.MapLocationResponse, 'treasureMission' | 'cooperativeMission'> & {
  mission: MapContentsMission | null;
};
export type DetailedMapContents = {
  locations: MapContentsLocation[];
  roadGuestbooks: GeneratedApi.MapRoadGuestbookResponse[];
};
export type ClusteredMapContents = {
  locations: GeneratedApi.ClusteredLocationResponse[];
  roadGuestbooks: Pick<GeneratedApi.MapRoadGuestbookResponse, 'id' | 'latitude' | 'longitude'>[];
};

/** 장소·길바닥 방명록 조회가 같은 파라미터의 응답을 공유한다. */
export function getMapContentsQueryKey(params: MapContentsParams) {
  return ['/api/v2/map/contents', params] as const;
}

/** 기존 인증·오류 토스트 공통 처리를 거쳐 v2 지도 홈을 조회한다. */
export function getMapContents(params: MapContentsParams, signal?: AbortSignal) {
  return orvalClient<DetailedMapContents | ClusteredMapContents>({ url: '/api/v2/map/contents', method: 'GET', params, signal });
}
