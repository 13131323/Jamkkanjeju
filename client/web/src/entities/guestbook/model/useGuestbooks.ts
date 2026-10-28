'use client';

import type { GeneratedApi } from '@packages/shared';
import { useGetGuestbooksApiV1GuestbooksGet } from '@/services/api/guestbook/guestbook';

// GET /api/v1/guestbooks — travel-note 피드(GuestbookFeedView)가 쓴다. scope 생략 시 서버 기본값은 ALL.
export function useGuestbooks(scope?: GeneratedApi.GuestbookScope) {
  return useGetGuestbooksApiV1GuestbooksGet(
    { scope },
    {
      query: {
        // 조회 실패를 피드 화면에서 직접 처리하기 위해 queryClient 기본값(throwOnError:true)을 이 쿼리에서만 끈다.
        throwOnError: false,
      },
    },
  );
}
