'use client';

import { useQueryClient } from '@tanstack/react-query';
import { getGetMypageApiV1UsersMeMypageGetQueryKey, getGetUserInfoApiV1UsersMeGetQueryKey, useUpdateUserInfoApiV1UsersMeProfilePut } from '@/services/api/mypage/mypage';

// PUT /api/v1/users/me/profile — 프로필 전체 교체(부분 갱신 아님). 성공하면 GET /users/me, GET /users/me/mypage
// 캐시를 갱신해, 수정 화면에서 저장하고 돌아왔을 때 마이페이지 요약이 바로 최신값을 보여주게 한다.
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useUpdateUserInfoApiV1UsersMeProfilePut({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUserInfoApiV1UsersMeGetQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMypageApiV1UsersMeMypageGetQueryKey() });
      },
    },
  });
}
