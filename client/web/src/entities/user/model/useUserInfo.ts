'use client';

import { useGetUserInfoApiV1UsersMeGet } from '@/services/api/mypage/mypage';

// GET /api/v1/users/me — 프로필 수정 화면(MyPageEditView) 진입 시 현재 값을 채우는 데 쓴다.
export function useUserInfo() {
  return useGetUserInfoApiV1UsersMeGet({
    query: {
      throwOnError: false,
    },
  });
}
