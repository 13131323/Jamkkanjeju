'use client';

import { useGetTravelEndingElementsApiV1UsersMeTravelEndingElementsGet } from '@/services/api/mypage/mypage';

// GET /api/v1/users/me/travel-ending-elements — 여행 마무리 엽서에 담을 수 있는 방문 장소/완료 미션 요약.
// 엽서를 만드는 화면(TravelEndingPage)이 이 데이터로 선택 목록을 채운다.
export function useTravelEndingElements() {
  return useGetTravelEndingElementsApiV1UsersMeTravelEndingElementsGet({
    query: {
      throwOnError: false,
    },
  });
}
