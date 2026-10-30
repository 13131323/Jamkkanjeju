import { beforeEach, expect, it, vi } from 'vitest';
import { orvalClient } from '@shared/api/axios/instance';
import { createGuestbook } from './createGuestbook';
import { canWriteGuestbookAt } from './checkGuestbookWriteAvailability';

vi.mock('@shared/api/axios/instance', () => ({ orvalClient: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

function body() {
  const request = vi.mocked(orvalClient).mock.calls.at(-1)?.[0];
  expect(request).toMatchObject({ url: '/api/v2/guestbooks', method: 'POST' });
  expect(request).not.toHaveProperty('headers');
  return request?.data as FormData;
}

it('일반 방명록은 v2 단일 파일 필드와 사용자 오디오 제목으로 업로드한다', async () => {
  const photo = new File(['photo'], 'jeju.jpg', { type: 'image/jpeg' });
  const audio = new File(['audio'], 'sea.mp3', { type: 'audio/mpeg' });
  vi.mocked(orvalClient).mockResolvedValueOnce({ guestbookId: 15 });
  await expect(createGuestbook({ guestbookType: 'GENERAL', locationId: 1, missionId: 30,
    latitude: 33, longitude: 126, locationAlias: '미전송', visitedAt: '2026-10-30',
    imageFile: photo, audioFile: audio, audioTitle: '파도 소리', contentWriting: '후기',
    contentTemperatureCelsius: 0 })).resolves.toEqual({ guestbookId: 15 });
  const form = body();
  expect(form.get('locationId')).toBe('1');
  expect(form.get('missionId')).toBe('30');
  expect(form.get('imageFile')).toMatchObject({ name: 'jeju.jpg', size: 5 });
  expect(form.get('audioFile')).toMatchObject({ name: 'sea.mp3', size: 5 });
  expect(form.get('audioTitle')).toBe('파도 소리');
  expect(form.get('contentTemperatureCelsius')).toBe('0');
  for (const key of ['latitude', 'longitude', 'locationAlias', 'imageFiles', 'audioFiles']) expect(form.has(key)).toBe(false);
});

it('길바닥은 좌표·별칭만 전송하고 없는 파일·제목·장소·미션을 보내지 않는다', async () => {
  await createGuestbook({ guestbookType: 'ROAD', locationAlias: '돌담길', latitude: 0, longitude: 126,
    visitedAt: '2026-10-30', locationId: 1, missionId: 2, audioTitle: '오디오 없음', imageFile: null });
  const form = body();
  expect(form.get('latitude')).toBe('0');
  expect(form.get('locationAlias')).toBe('돌담길');
  for (const key of ['locationId', 'missionId', 'audioFile', 'imageFile', 'audioTitle']) expect(form.has(key)).toBe(false);
});

it('장소 작성 진입은 v2 응답의 방문 목록을 사용하고 기록 개수와 무관하게 판단한다', async () => {
  vi.mocked(orvalClient).mockResolvedValue({ visitedLocations: [{ id: 1, locationTitle: '방문 장소' }] });
  await expect(canWriteGuestbookAt(1)).resolves.toBe(true);
  await expect(canWriteGuestbookAt(2)).resolves.toBe(false);
  expect(orvalClient).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/api/v2/guestbooks', method: 'GET' }));
});
