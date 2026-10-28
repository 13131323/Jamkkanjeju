'use client';

import { useQueryClient } from '@tanstack/react-query';
import type { GeneratedApi } from '@packages/shared';
import { useSetGuestbookLikeApiV1GuestbooksGuestbookIdLikePut } from '@/services/api/guestbook/guestbook';

// GET /api/v1/guestbooks 쿼리의 키 접두어(useGuestbooks.ts) — scope별로 캐시가 여러 개 있을 수 있어 접두어로 전부 매칭한다.
const GUESTBOOKS_QUERY_KEY_PREFIX = ['/api/v1/guestbooks'];

// PUT /api/v1/guestbooks/{guestbookId}/like 연동.
// 화면(GuestbookDetailModal)이 클릭 즉시 자체 상태로 낙관적 업데이트를 하고, 이 훅은 성공 시 서버가 확정한
// isLiked/likeCount를 GET /api/v1/guestbooks 캐시에도 반영해 목록으로 돌아가거나 모달을 다시 열어도 어긋나지 않게 한다.
export function useToggleGuestbookLike() {
  const queryClient = useQueryClient();
  const { mutate } = useSetGuestbookLikeApiV1GuestbooksGuestbookIdLikePut();

  function toggleLike(target: { id: number; guestbookType: GeneratedApi.GuestbookType }, nextIsLiked: boolean, callbacks?: { onError?: () => void }) {
    mutate(
      { guestbookId: target.id, data: { guestbookType: target.guestbookType, isLiked: nextIsLiked } },
      {
        onSuccess: (response) => {
          queryClient.setQueriesData<GeneratedApi.GuestbookListResponse>({ queryKey: GUESTBOOKS_QUERY_KEY_PREFIX }, (data) => (data ? applyLikeResult(data, response) : data));
        },
        onError: () => callbacks?.onError?.(),
      },
    );
  }

  return { toggleLike };
}

function applyLikeResult(data: GeneratedApi.GuestbookListResponse, result: GeneratedApi.GuestbookLikeResponse): GeneratedApi.GuestbookListResponse {
  if (result.guestbookType === 'GENERAL') {
    return {
      ...data,
      generalGuestbooks: data.generalGuestbooks.map((item) => (item.id === result.guestbookId ? { ...item, isLiked: result.isLiked, likeCount: result.likeCount } : item)),
    };
  }
  return {
    ...data,
    roadGuestbooks: data.roadGuestbooks.map((item) => (item.id === result.guestbookId ? { ...item, isLiked: result.isLiked, likeCount: result.likeCount } : item)),
  };
}
