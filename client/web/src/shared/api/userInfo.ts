import { orvalClient } from './axios/instance';

export type UserInfoResponse = {
  userType: string | null;
  characterImgUrl: string | null;
  nickname: string | null;
  expectations: ('PHOTO' | 'LOCAL' | 'NATURE' | 'CULTURE' | 'CAFE' | 'WALKING')[];
  transportation: 'WALK' | 'BUS' | 'CAR' | 'BICYCLE' | null;
  travelStyle: 'RIGHT_HERE' | 'NEAR_AROUND' | 'NEAR_DESTINATION' | null;
  targetStepCount: number;
};

export const USER_INFO_QUERY_KEY = ['/api/v2/users/me'] as const;

export type UpdateUserInfoRequest = Partial<{
  nickname: string;
  expectations: UserInfoResponse['expectations'];
  transportation: UserInfoResponse['transportation'];
  travelStyle: UserInfoResponse['travelStyle'];
  targetStepCount: number;
}>;

/** 프로필 수정 화면에 표시할 사용자 정보와 현재 여행 선택값을 조회한다. */
export function getUserInfo(signal?: AbortSignal) {
  return orvalClient<UserInfoResponse>({ url: '/api/v2/users/me', method: 'GET', signal });
}

/** 변경한 항목만 전송하고 생략한 저장값은 유지한다. */
export function updateUserInfo(data: UpdateUserInfoRequest) {
  return orvalClient<void>({ url: '/api/v2/users/me/profile', method: 'PATCH', data });
}
