import { orvalClient } from './axios/instance';

export type MyPageMission = {
  missionId: number;
  missionType: 'CULTURE' | 'TREASURE' | 'COOPERATIVE';
  missionTitle: string;
};
export type MyPageProgressMission = MyPageMission & { currentCount: number; totalCount: number };
export type MyPageProfile = {
  nickname: string | null;
  travelStyle: { userType: string; hashtags: string[] } | null;
  characterImgUrl: string | null;
};
export type MyPageSummary = { visitedLocationCount: number; completedMissionCount: number; point: number };
export type MyPageArCharacter = {
  id: number; name: string; imageUrl: string; characterColor: string | null;
  requiredFragmentCount: number; acquiredFragmentCount: number; isAcquired: boolean; acquiredAt: string | null;
  storyTitle: string; storyContent: string; hashtags: string[]; acquireCondition: string;
  availableMissions: MyPageMission[];
};
export type MyPageResponse = {
  profile: MyPageProfile;
  dailyStep: { targetStepCount: number };
  summary: MyPageSummary;
  progressMissions: MyPageProgressMission[];
  arCharacters: MyPageArCharacter[];
};
export const MY_PAGE_QUERY_KEY = ['/api/v2/users/me/mypage'] as const;

/** 프로필·진행 중인 미션·캐릭터 조각 도감을 한 번에 조회한다. */
export function getMyPage(signal?: AbortSignal) {
  return orvalClient<MyPageResponse>({ url: '/api/v2/users/me/mypage', method: 'GET', signal });
}
