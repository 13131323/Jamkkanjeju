'use client';

import { useGetMypageApiV1UsersMeMypageGet } from '@/services/api/mypage/mypage';

// GET /api/v1/users/me/mypage — 마이페이지 요약 화면(MyPageSummaryView)이 쓴다.
export function useMyPage() {
  return useGetMypageApiV1UsersMeMypageGet({
    query: {
      // 조회 실패를 화면에서 직접 처리하기 위해 queryClient 기본값(throwOnError:true)을 이 쿼리에서만 끈다.
      throwOnError: false,
    },
  });
}
