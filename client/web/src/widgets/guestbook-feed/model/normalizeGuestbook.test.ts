import { describe, expect, it } from 'vitest';
import type { GeneralGuestbook, RoadGuestbook } from '@shared/api/guestbooks';
import { normalizeGeneralGuestbook, normalizeRoadGuestbook } from '@widgets/guestbook-feed/model/normalizeGuestbook';

function general(id: number): GeneralGuestbook {
  return { id, userId: 1, userNickname: null, characterImgUrl: null, visitedAt: '2026-10-29', savedAt: '2026-10-29T12:00:00',
    contentImageUrl: 'https://example.com/photo.png', contentAudioUrl: 'https://example.com/audio.mp3',
    contentWriting: null, audioTitle: '산책', contentWeather: null, contentTemperatureCelsius: null,
    contentColorCode: null, isLiked: false, likeCount: 0, mission: null,
    location: { id: 1, locationTitle: '장소', locationAddress: '제주시', locationCategory: '음식', latitude: 33.5, longitude: 126.5 } };
}

function road(id: number): RoadGuestbook {
  return { ...general(id), userId: null, locationAlias: '돌담길', latitude: 33.5, longitude: 126.5,
    contentImageUrl: null, contentAudioUrl: null };
}


describe('v2 방명록 조회 연결', () => {
  it('일반 방명록의 단일 첨부 URL과 작성자 ID를 카드에 전달한다', () => {
    expect(normalizeGeneralGuestbook(general(1))).toMatchObject({ userId: 1, userNickname: null,
      contentImageUrls: ['https://example.com/photo.png'], contentAudioUrls: ['https://example.com/audio.mp3'] });
  });

  it('길바닥 방명록의 없는 작성자·첨부 파일을 null로 유지한다', () => {
    expect(normalizeRoadGuestbook(road(2))).toMatchObject({ userId: null, userNickname: null,
      contentImageUrls: null, contentAudioUrls: null, displayLocationName: '돌담길' });
  });




});
