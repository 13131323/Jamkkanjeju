'use client';

import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GUESTBOOKS_QUERY_KEY, toggleGuestbookLike, type GuestbooksResponse, type GuestbookLikeResponse } from '@shared/api/guestbooks';

/** 처리 중 중복 호출과 자동 재시도를 막고 모든 방명록 페이지에 서버 응답을 반영한다. */
export function useToggleGuestbookLike() {
  const queryClient = useQueryClient();
  const pendingRef = useRef(false);
  const mutation = useMutation({
    mutationFn: toggleGuestbookLike,
    retry: false,
    onSuccess: (result) => {
      queryClient.setQueriesData<GuestbooksResponse>({ queryKey: GUESTBOOKS_QUERY_KEY }, (data) => {
        if (!data) return data;
        const update = <T extends { id: number }>(item: T) => item.id === result.guestbookId ? { ...item, isLiked: result.isLiked, likeCount: result.likeCount } : item;
        return { ...data, generalGuestbooks: data.generalGuestbooks.map(update), roadGuestbooks: data.roadGuestbooks.map(update) };
      });
      // 좋아요한 목록의 포함 여부와 인기순 페이지도 서버 기준으로 다시 조회한다.
      void queryClient.invalidateQueries({ queryKey: GUESTBOOKS_QUERY_KEY });
    },
    // 전송 결과가 불확실해도 다시 토글하지 않고 조회로 현재 상태를 확인한다.
    onError: () => { void queryClient.invalidateQueries({ queryKey: GUESTBOOKS_QUERY_KEY }); },
    onSettled: () => { pendingRef.current = false; },
  });

  function toggleLike(id: number, callbacks?: { onSuccess?: (result: GuestbookLikeResponse) => void }) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    mutation.mutate(id, { onSuccess: callbacks?.onSuccess });
  }

  return { toggleLike, isPending: mutation.isPending };
}
