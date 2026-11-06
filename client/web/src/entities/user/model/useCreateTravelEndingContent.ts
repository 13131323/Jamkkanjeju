'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MY_PAGE_QUERY_KEY, type MyPageResponse } from '@shared/api/myPage';
import { TRAVEL_ENDING_ELEMENTS_QUERY_KEY, type TravelEndingElementsResponse } from '@shared/api/travelEndingElements';
import { createTravelEndingContent } from '@shared/api/travelEndingContent';

// 성공하면 포인트가 차감되므로 travel-ending-elements(이 화면의 point 표시)와
// mypage(요약 화면의 point 표시) 캐시를 갱신한다.
export function useCreateTravelEndingContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTravelEndingContent,
    onSuccess: (result) => {
      queryClient.setQueryData<TravelEndingElementsResponse>(TRAVEL_ENDING_ELEMENTS_QUERY_KEY,
        (current) => current ? { ...current, point: result.remainingPoint } : current);
      queryClient.setQueryData<MyPageResponse>(MY_PAGE_QUERY_KEY,
        (current) => current ? { ...current, summary: { ...current.summary, point: result.remainingPoint } } : current);
      queryClient.invalidateQueries({ queryKey: TRAVEL_ENDING_ELEMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MY_PAGE_QUERY_KEY });
    },
  });
}
