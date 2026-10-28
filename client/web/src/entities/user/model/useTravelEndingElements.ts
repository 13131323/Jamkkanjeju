'use client';

import { useGetTravelEndingElementsApiV1UsersMeTravelEndingElementsGet } from '@/services/api/mypage/mypage';

// GET /api/v1/users/me/travel-ending-elements — 여행 마무리 엽서에 담을 수 있는 방문 장소/완료 미션 요약.
// 실제로 요소를 골라 엽서를 만드는 화면(POST /users/me/travel-ending-contents)은 아직 없어서,
// 지금은 "여행 엽서 만들기" CTA를 누를 만한 재료가 있는지 판단하는 용도로만 쓴다.
export function useTravelEndingElements() {
  return useGetTravelEndingElementsApiV1UsersMeTravelEndingElementsGet({
    query: {
      throwOnError: false,
    },
  });
}
