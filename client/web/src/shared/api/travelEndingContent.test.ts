import { expect, it, vi } from 'vitest';
import { orvalClient } from './axios/instance';
import { createTravelEndingContent } from './travelEndingContent';

vi.mock('./axios/instance', () => ({ orvalClient: vi.fn() }));

it('v2 경로에 ID JSON 배열과 반복 사진 필드를 보내고 생성 결과를 반환한다', async () => {
  const result = { id: 12, imageUrl: 'https://example.invalid/postcard.png', remainingPoint: 100 };
  vi.mocked(orvalClient).mockResolvedValueOnce(result);
  const photos = [new File(['one'], 'one.png', { type: 'image/png' }), new File(['two'], 'two.jpg', { type: 'image/jpeg' })];
  expect(await createTravelEndingContent({ visitedLocationIds: [3, 1], missionIds: [32, 1], photos, travelNote: '제주 기억' })).toEqual(result);
  const config = vi.mocked(orvalClient).mock.calls.at(-1)![0];
  expect(config).toMatchObject({ url: '/api/v2/users/me/travel-ending-contents', method: 'POST', timeout: 240_000 });
  expect(config.headers).toBeUndefined();
  const body = config.data as FormData;
  expect(body.getAll('visitedLocationIds')).toEqual(['[3,1]']);
  expect(body.getAll('missionIds')).toEqual(['[32,1]']);
  expect(body.has('missions')).toBe(false);
  expect(body.getAll('photos')).toEqual(photos);
  expect(body.get('travelNote')).toBe('제주 기억');
});

it('여행 한 줄 미입력은 필드를 생략하고 요청 오류는 호출부로 전달한다', async () => {
  const failure = new Error('503');
  vi.mocked(orvalClient).mockRejectedValueOnce(failure);
  await expect(createTravelEndingContent({ visitedLocationIds: [1], missionIds: [1], photos: [], travelNote: null })).rejects.toBe(failure);
  const body = vi.mocked(orvalClient).mock.calls.at(-1)![0].data as FormData;
  expect(body.has('travelNote')).toBe(false);
});
