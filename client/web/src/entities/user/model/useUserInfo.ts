'use client';

import { useQuery } from '@tanstack/react-query';
import { getUserInfo, USER_INFO_QUERY_KEY } from '@shared/api/userInfo';

// GET /api/v2/users/me — 프로필 수정 화면 진입 시 현재 저장값을 채운다.
export function useUserInfo() {
  return useQuery({
    queryKey: USER_INFO_QUERY_KEY,
    queryFn: ({ signal }) => getUserInfo(signal),
    throwOnError: false,
  });
}
