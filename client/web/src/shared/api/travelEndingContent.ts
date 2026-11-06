import { orvalClient } from './axios/instance';

export type CreateTravelEndingContentRequest = {
  visitedLocationIds: number[];
  missionIds: number[];
  photos: File[];
  travelNote?: string | null;
};
export type CreateTravelEndingContentResponse = { id: number; imageUrl: string; remainingPoint: number };

/** ID 배열은 JSON 문자열 한 필드로, 사진은 같은 필드명을 반복하여 전송한다. */
export function createTravelEndingContent(input: CreateTravelEndingContentRequest) {
  const data = new FormData();
  data.append('visitedLocationIds', JSON.stringify(input.visitedLocationIds));
  data.append('missionIds', JSON.stringify(input.missionIds));
  input.photos.forEach((photo) => data.append('photos', photo));
  if (input.travelNote != null) data.append('travelNote', input.travelNote);
  // multipart 경계는 브라우저가 설정한다. 참조 이미지 준비·AI 생성 대기를 포함해 기다린다.
  return orvalClient<CreateTravelEndingContentResponse>({
    url: '/api/v2/users/me/travel-ending-contents', method: 'POST', data, timeout: 240_000,
  });
}
