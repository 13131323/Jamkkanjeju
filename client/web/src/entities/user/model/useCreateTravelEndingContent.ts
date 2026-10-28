'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GeneratedApi } from '@packages/shared';
import { orvalClient } from '@shared/api/axios/instance';
import { getGetMypageApiV1UsersMeMypageGetQueryKey, getGetTravelEndingElementsApiV1UsersMeTravelEndingElementsGetQueryKey } from '@/services/api/mypage/mypage';

// POST /api/v1/users/me/travel-ending-contents — orval이 생성한
// createTravelEndingContentApiV1UsersMeTravelEndingContentsPost(services/api/mypage/mypage.ts)는
// visitedLocationIds/missions를 배열 원소마다 formData.append로 반복 추가하는데, 백엔드 문서
// (packages/shared/src/api/generated/travelEndingContentCreateRequest.ts 상단 주석)는 이 둘을
// **배열 전체를 JSON 문자열 한 필드로** 요구한다(어기면 400) — photos만 파일마다 반복이 맞다.
// createGuestbook.ts와 같은 이유로, 생성 파일은 손대지 않고(재생성 시 사라짐) 여기서 FormData를 직접 만든다.
function toFormData(input: GeneratedApi.TravelEndingContentCreateRequest): FormData {
  const formData = new FormData();
  formData.append('visitedLocationIds', JSON.stringify(input.visitedLocationIds));
  formData.append('missions', JSON.stringify(input.missions));
  input.photos.forEach((file) => formData.append('photos', file));
  if (input.travelNote != null) formData.append('travelNote', input.travelNote);
  return formData;
}

function createTravelEndingContent(input: GeneratedApi.TravelEndingContentCreateRequest): Promise<GeneratedApi.TravelEndingContentCreateResponse> {
  return orvalClient<GeneratedApi.TravelEndingContentCreateResponse>({
    url: '/api/v1/users/me/travel-ending-contents',
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data' },
    data: toFormData(input),
  });
}

// 성공하면 포인트가 차감되므로 travel-ending-elements(이 화면의 point 표시)와
// mypage(요약 화면의 point 표시) 캐시를 갱신한다.
export function useCreateTravelEndingContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTravelEndingContent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetTravelEndingElementsApiV1UsersMeTravelEndingElementsGetQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMypageApiV1UsersMeMypageGetQueryKey() });
    },
  });
}
