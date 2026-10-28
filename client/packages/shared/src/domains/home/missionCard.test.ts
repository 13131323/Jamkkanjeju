import { describe, expect, it } from 'vitest';
import { formatDistanceLabel, MISSION_ROUTE_BY_TYPE, toHomeMissionCards } from './missionCard';

describe('MISSION_ROUTE_BY_TYPE', () => {
  it('서버 미션 유형을 화면 라우트 값으로 바꾼다', () => {
    expect(MISSION_ROUTE_BY_TYPE.CULTURE).toBe('culture');
    expect(MISSION_ROUTE_BY_TYPE.TREASURE).toBe('treasure');
    expect(MISSION_ROUTE_BY_TYPE.COOPERATIVE).toBe('coop');
  });
});

describe('formatDistanceLabel', () => {
  it('1km 미만은 m로 보여준다', () => {
    expect(formatDistanceLabel(996)).toBe('996m');
    expect(formatDistanceLabel(1)).toBe('1m');
  });

  it('1km 이상은 소수 한 자리 km로 보여준다', () => {
    expect(formatDistanceLabel(1000)).toBe('1.0km');
    expect(formatDistanceLabel(25122)).toBe('25.1km');
    expect(formatDistanceLabel(3149)).toBe('3.1km');
  });

  it('m 값은 반올림해 소수점을 남기지 않는다', () => {
    expect(formatDistanceLabel(996.4)).toBe('996m');
  });

  it('0m도 유효한 거리다 — 값 없음(null)과 구분한다', () => {
    expect(formatDistanceLabel(0)).toBe('0m');
  });

  it('거리를 모르면 null이다', () => {
    expect(formatDistanceLabel(null)).toBeNull();
    expect(formatDistanceLabel(undefined)).toBeNull();
  });
});

describe('toHomeMissionCards', () => {
  const recommend = [
    {
      missionId: 2,
      missionType: 'COOPERATIVE' as const,
      missionTitle: '함께 키우는 귤나무',
      locationTitle: '카멜리아힐',
      distanceMeter: 25122,
      durationMinutes: 335,
    },
    {
      missionId: 1,
      missionType: 'TREASURE' as const,
      missionTitle: '보물 찾기',
      locationTitle: null,
      distanceMeter: null,
      durationMinutes: null,
    },
  ];

  it('추천 미션을 카드로 옮긴다', () => {
    expect(toHomeMissionCards(recommend)[0]).toEqual({
      key: 'COOPERATIVE-2',
      missionId: 2,
      route: 'coop',
      title: '함께 키우는 귤나무',
      placeLabel: '카멜리아힐',
      distanceLabel: '25.1km',
      durationMinutes: 335,
    });
  });

  it('장소가 없는 미션은 관련 필드가 전부 null이다', () => {
    expect(toHomeMissionCards(recommend)[1]).toEqual({
      key: 'TREASURE-1',
      missionId: 1,
      route: 'treasure',
      title: '보물 찾기',
      placeLabel: null,
      distanceLabel: null,
      durationMinutes: null,
    });
  });

  it('같은 id라도 유형이 다르면 key가 겹치지 않는다 — 유형별 테이블의 id라 값이 겹친다', () => {
    const cards = toHomeMissionCards([
      { missionId: 1, missionType: 'CULTURE' as const, missionTitle: '퀴즈' },
      { missionId: 1, missionType: 'TREASURE' as const, missionTitle: '보물 찾기' },
    ]);

    expect(cards[0].key).not.toBe(cards[1].key);
  });

  it('빈 목록은 빈 배열이다', () => {
    expect(toHomeMissionCards([])).toEqual([]);
  });
});
