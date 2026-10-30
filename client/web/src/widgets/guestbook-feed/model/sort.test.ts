import { expect, it } from 'vitest';
import { sortGuestbooks, SORT_OPTION_LABEL } from './sort';
import { getCardCandidates } from './cardCandidates';
import { buildCardData } from './buildCardData';
import type { NormalizedGuestbook } from './normalizeGuestbook';

function record(id: number, likes: number, time: string): NormalizedGuestbook {
  return { id, key: `general-${id}`, kind: 'GENERAL', displayLocationName: '장소', locationTitle: '장소',
    characterImgUrl: null, userNickname: null, visitedAt: '2026-10-30', savedAt: time,
    contentImageUrls: null, contentAudioUrls: null, contentWriting: null, audioTitle: null,
    contentWeather: '맑음', contentColorCode: null, mission: null, likeCount: likes, isLiked: false };
}

it('두 유형의 인기순 페이지를 합칠 때 좋아요·시각·ID 기준을 지키고 모든 기록을 유지한다', () => {
  const first = record(1, 4, '2026-10-30T10:00:00');
  const second = { ...record(2, 4, '2026-10-30T10:00:00'), kind: 'ROAD' as const, key: 'road-2' };
  const recent = record(3, 0, '2026-10-30T11:00:00');
  expect(sortGuestbooks([first, recent, second], 'POPULAR').map((item) => item.id)).toEqual([2, 1, 3]);
  expect(sortGuestbooks([first, recent, second], 'LIKED').map((item) => item.id)).toEqual([3, 2, 1]);
  expect(SORT_OPTION_LABEL.MINE).toBe('내 방명록');
  expect(SORT_OPTION_LABEL.LIKED).toBe('좋아요한 방명록');
});

it('날씨만 있는 응답도 메모 카드로 표시한다', () => {
  const weather = record(1, 0, '2026-10-30T10:00:00');
  expect(getCardCandidates(weather)).toEqual(['note']);
  expect(buildCardData(weather, 'note')).toMatchObject({ id: 'general-1', type: 'note', text: '맑음' });
});
