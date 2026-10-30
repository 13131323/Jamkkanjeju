'use client';

import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { orvalClient } from '@shared/api/axios/instance';
import { GUESTBOOKS_QUERY_KEY } from '@shared/api/guestbooks';

/** v2 작성 API에 전송할 단일 첨부 파일과 콘텐츠이다. */
export type CreateGuestbookInput = {
  guestbookType: 'GENERAL' | 'ROAD';
  locationId?: number | null;
  locationAlias?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  visitedAt: string;
  imageFile?: File | null;
  audioFile?: File | null;
  audioTitle?: string | null;
  contentWriting?: string | null;
  contentWeather?: string | null;
  contentTemperatureCelsius?: number | null;
  contentColorCode?: string | null;
  missionId?: number | null;
};
export type CreateGuestbookResponse = {
  guestbookId: number; guestbookType: 'GENERAL' | 'ROAD'; locationId: number | null;
  locationAlias: string | null; latitude: number | null; longitude: number | null;
  visitedAt: string; contentImageUrl: string | null; contentWriting: string | null;
  contentAudioUrl: string | null; audioTitle: string | null; contentWeather: string | null;
  contentTemperatureCelsius: number | null; contentColorCode: string | null;
  missionId: number | null; savedAt: string;
};

/** 선택된 파일만 multipart로 전송하며 boundary는 브라우저가 설정한다. */
export function createGuestbook(input: CreateGuestbookInput): Promise<CreateGuestbookResponse> {
  const data = new FormData();
  data.append('guestbookType', input.guestbookType);
  data.append('visitedAt', input.visitedAt);
  const locationFields = input.guestbookType === 'GENERAL'
    ? { locationId: input.locationId, missionId: input.missionId }
    : { locationAlias: input.locationAlias, latitude: input.latitude, longitude: input.longitude };
  for (const [key, value] of Object.entries({ ...locationFields, contentWriting: input.contentWriting,
    contentWeather: input.contentWeather, contentTemperatureCelsius: input.contentTemperatureCelsius,
    contentColorCode: input.contentColorCode })) {
    if (value != null) data.append(key, String(value));
  }
  if (input.imageFile) data.append('imageFile', input.imageFile);
  if (input.audioFile) {
    data.append('audioFile', input.audioFile);
    if (input.audioTitle != null) data.append('audioTitle', input.audioTitle);
  }
  return orvalClient<CreateGuestbookResponse>({ url: '/api/v2/guestbooks', method: 'POST', data });
}

export function useCreateGuestbook(options?: UseMutationOptions<CreateGuestbookResponse, unknown, CreateGuestbookInput>) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: createGuestbook,
    retry: false,
    onSuccess: (...args) => {
      void queryClient.invalidateQueries({ queryKey: GUESTBOOKS_QUERY_KEY });
      options?.onSuccess?.(...args);
    },
  });
}
