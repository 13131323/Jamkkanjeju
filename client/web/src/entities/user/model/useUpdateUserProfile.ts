'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MY_PAGE_QUERY_KEY } from '@shared/api/myPage';
import { updateUserInfo, USER_INFO_QUERY_KEY } from '@shared/api/userInfo';

// PATCH 성공 후 사용자 정보와 마이페이지를 갱신해 재배정된 프로필까지 반영한다.
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserInfo,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: USER_INFO_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: MY_PAGE_QUERY_KEY }),
      ]);
    },
  });
}
