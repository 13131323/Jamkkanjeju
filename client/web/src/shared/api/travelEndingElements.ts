import { orvalClient } from './axios/instance';
import type { MapModalRewardDetail } from './mapModal';

export type TravelEndingVisitedLocation = { id: number; locationTitle: string };
export type TravelEndingCompletedMission = {
  missionId: number;
  missionType: 'CULTURE' | 'TREASURE' | 'COOPERATIVE';
  missionTitle: string;
  completedLocation: string | null;
  completedAt: string;
  rewardDetail: Required<MapModalRewardDetail>;
};
export type TravelEndingElementsResponse = {
  point: number;
  visitedLocationCount: number;
  visitedLocations: TravelEndingVisitedLocation[];
  completedMissionCount: number;
  completedMissions: TravelEndingCompletedMission[];
};

export const TRAVEL_ENDING_ELEMENTS_QUERY_KEY = ['/api/v2/users/me/travel-ending-elements'] as const;

/** 엽서에서 선택할 방문 장소·활성 완료 미션과 현재 포인트를 조회한다. */
export function getTravelEndingElements(signal?: AbortSignal) {
  return orvalClient<TravelEndingElementsResponse>({
    url: '/api/v2/users/me/travel-ending-elements', method: 'GET', signal,
  });
}
