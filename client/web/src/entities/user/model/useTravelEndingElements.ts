'use client';

import { useQuery } from '@tanstack/react-query';
import { getTravelEndingElements, TRAVEL_ENDING_ELEMENTS_QUERY_KEY } from '@shared/api/travelEndingElements';

// GET /api/v2/users/me/travel-ending-elements — 엽서에 담을 방문 장소·활성 완료 미션 요약.
// 엽서를 만드는 화면(TravelEndingPage)이 이 데이터로 선택 목록을 채운다.
export function useTravelEndingElements() {
  return useQuery({
    queryKey: TRAVEL_ENDING_ELEMENTS_QUERY_KEY,
    queryFn: ({ signal }) => getTravelEndingElements(signal),
    throwOnError: false,
  });
}
