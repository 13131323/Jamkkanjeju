'use client';

import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import type { GeneratedApi } from '@packages/shared';
import { orvalClient } from '@shared/api/axios/instance';

// POST /api/v1/guestbooks — orval이 생성한 createGuestbookApiV1GuestbooksPost(services/api/guestbook/guestbook.ts)는
// imageFiles/audioFiles(Blob[])를 formData.append(key, blobArray)로 통째로 넣어버리는 버그가 있다
// (FormData.append는 파일 하나씩 넣어야 한다 — 배열을 그대로 넘기면 타입 에러이자 런타임에서도 깨진다).
// 생성 파일은 "Do not edit manually"라 손대지 않고(재생성 시 사라짐) 여기서 FormData를 직접 만든다.
function toFormData(input: GeneratedApi.GuestbookCreateRequest): FormData {
  const formData = new FormData();
  formData.append('guestbookType', input.guestbookType);
  if (input.locationId != null) formData.append('locationId', String(input.locationId));
  if (input.locationAlias != null) formData.append('locationAlias', input.locationAlias);
  if (input.latitude != null) formData.append('latitude', String(input.latitude));
  if (input.longitude != null) formData.append('longitude', String(input.longitude));
  formData.append('visitedAt', input.visitedAt);
  if (input.contentWriting != null) formData.append('contentWriting', input.contentWriting);
  if (input.contentWeather != null) formData.append('contentWeather', input.contentWeather);
  if (input.contentTemperatureCelsius != null) formData.append('contentTemperatureCelsius', String(input.contentTemperatureCelsius));
  if (input.contentColorCode != null) formData.append('contentColorCode', input.contentColorCode);
  if (input.missionId != null) formData.append('missionId', String(input.missionId));
  input.imageFiles?.forEach((file) => formData.append('imageFiles', file));
  input.audioFiles?.forEach((file) => formData.append('audioFiles', file));
  return formData;
}

function createGuestbook(input: GeneratedApi.GuestbookCreateRequest): Promise<GeneratedApi.GuestbookCreateResponse> {
  return orvalClient<GeneratedApi.GuestbookCreateResponse>({
    url: '/api/v1/guestbooks',
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data' },
    data: toFormData(input),
  });
}

export function useCreateGuestbook(
  options?: UseMutationOptions<GeneratedApi.GuestbookCreateResponse, unknown, GeneratedApi.GuestbookCreateRequest>,
) {
  return useMutation({ mutationFn: createGuestbook, ...options });
}
