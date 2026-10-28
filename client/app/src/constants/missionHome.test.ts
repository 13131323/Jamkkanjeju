import { describe, expect, it } from 'vitest';
import { FALLBACK_MISSION_ID, MISSION_TYPE_INPUT, resolveMissionId, splitMissionTitle, toMissionRewards, toMissionSteps } from './missionHome';

const IMAGES = {
  arCharacter: 1 as never,
  point: 2 as never,
  coupon: 3 as never,
};

describe('splitMissionTitle', () => {
  it('마지막 공백에서 두 조각으로 나눈다', () => {
    expect(splitMissionTitle('함께 키우는 귤나무')).toEqual({ leading: '함께 키우는', trailing: '귤나무' });
    expect(splitMissionTitle('보물 찾기')).toEqual({ leading: '보물', trailing: '찾기' });
    expect(splitMissionTitle('제주 문화 퀴즈')).toEqual({ leading: '제주 문화', trailing: '퀴즈' });
  });

  it('공백이 없으면 전부 trailing에 넣는다 — 강조 조각이 비면 제목이 사라져 보인다', () => {
    expect(splitMissionTitle('퀴즈')).toEqual({ leading: '', trailing: '퀴즈' });
  });

  it('앞뒤 공백은 무시한다', () => {
    expect(splitMissionTitle('  보물 찾기  ')).toEqual({ leading: '보물', trailing: '찾기' });
  });

  it('빈 문자열은 두 조각 모두 빈 값이다', () => {
    expect(splitMissionTitle('')).toEqual({ leading: '', trailing: '' });
  });
});

describe('toMissionSteps', () => {
  it('서버 단계를 레이아웃 형태로 옮긴다', () => {
    expect(
      toMissionSteps([
        { step: 1, stepTitle: '퀴즈 시작하기', description: '풀어보세요' },
        { step: 2, stepTitle: '3문제 풀기', description: '고르세요' },
      ]),
    ).toEqual([
      { number: 1, title: '퀴즈 시작하기', description: '풀어보세요' },
      { number: 2, title: '3문제 풀기', description: '고르세요' },
    ]);
  });

  it('빈 목록도 그대로 통과시킨다', () => {
    expect(toMissionSteps([])).toEqual([]);
  });
});

describe('toMissionRewards', () => {
  it('세 보상을 캐릭터·포인트·쿠폰 순으로 만든다', () => {
    const rewards = toMissionRewards(
      {
        arCharacter: { id: 1, name: '돌담이', imageUrl: 'https://example.com/a.png' },
        point: 100,
        coupon: { couponLocation: '종화네 막국수', couponPrice: 1000 },
      },
      IMAGES,
    );

    expect(rewards).toEqual([
      { image: { uri: 'https://example.com/a.png' }, fallbackImage: IMAGES.arCharacter, label: '돌담이' },
      { image: IMAGES.point, label: '+100P' },
      { image: IMAGES.coupon, label: '1,000원 쿠폰' },
    ]);
  });

  it('캐릭터 배지에만 번들 폴백을 달아준다 — 원격 URL이 죽어도 원이 비지 않아야 한다', () => {
    const rewards = toMissionRewards(
      {
        arCharacter: { id: 1, name: '자청비 모티브 탐험가', imageUrl: 'https://cdn.jamkkan-jeju.dev/ar/jacheongbi-explorer.png' },
        point: 100,
        coupon: { couponLocation: '제주 기념품숍', couponPrice: 1000 },
      },
      IMAGES,
    );

    // 서버 URL은 그대로 남아야 한다 — CDN이 살아나면 실제 캐릭터가 나와야 하므로 폴백으로 덮지 않는다
    expect(rewards[0].image).toEqual({ uri: 'https://cdn.jamkkan-jeju.dev/ar/jacheongbi-explorer.png' });
    expect(rewards[0].fallbackImage).toBe(IMAGES.arCharacter);
    // 포인트·쿠폰은 이미 번들 에셋이라 폴백이 필요 없다
    expect(rewards[1].fallbackImage).toBeUndefined();
    expect(rewards[2].fallbackImage).toBeUndefined();
  });

  it('이미 지급된(null) 보상은 뺀다', () => {
    const rewards = toMissionRewards({ arCharacter: null, point: 100, coupon: null }, IMAGES);

    expect(rewards).toEqual([{ image: IMAGES.point, label: '+100P' }]);
  });

  it('보상이 전부 지급됐으면 빈 배열이다', () => {
    expect(toMissionRewards({ arCharacter: null, point: null, coupon: null }, IMAGES)).toEqual([]);
  });

  it('필드가 아예 없는 응답도 빈 배열로 다룬다', () => {
    expect(toMissionRewards({}, IMAGES)).toEqual([]);
  });

  it('쿠폰 금액에 천 단위 구분을 넣는다', () => {
    const rewards = toMissionRewards({ coupon: { couponLocation: '카페', couponPrice: 10000 } }, IMAGES);

    expect(rewards[0].label).toBe('10,000원 쿠폰');
  });

  it('포인트 0은 지급 완료(null)와 달리 그대로 보여준다', () => {
    const rewards = toMissionRewards({ point: 0 }, IMAGES);

    expect(rewards).toEqual([{ image: IMAGES.point, label: '+0P' }]);
  });
});

describe('MISSION_TYPE_INPUT', () => {
  it('화면 미션 종류를 서버 enum으로 바꾼다', () => {
    expect(MISSION_TYPE_INPUT.culture).toBe('CULTURE');
    expect(MISSION_TYPE_INPUT.treasure).toBe('TREASURE');
    expect(MISSION_TYPE_INPUT.coop).toBe('COOPERATIVE');
  });

  it('폴백 missionId가 세 종류 모두 있다', () => {
    expect(FALLBACK_MISSION_ID.culture).toBeGreaterThan(0);
    expect(FALLBACK_MISSION_ID.treasure).toBeGreaterThan(0);
    expect(FALLBACK_MISSION_ID.coop).toBeGreaterThan(0);
  });
});

describe('resolveMissionId', () => {
  it('브릿지가 보낸 id를 숫자로 바꾼다', () => {
    expect(resolveMissionId('7', 'culture')).toBe(7);
  });

  it('파라미터가 없으면 폴백을 쓴다 — missionId를 싣지 않는 옛 web 빌드', () => {
    expect(resolveMissionId(undefined, 'treasure')).toBe(FALLBACK_MISSION_ID.treasure);
  });

  it('숫자가 아니거나 0 이하면 폴백을 쓴다 — 잘못된 값을 그대로 보내면 404가 난다', () => {
    for (const bad of ['', 'abc', '0', '-3', '1.5', 'NaN']) {
      expect(resolveMissionId(bad, 'coop')).toBe(FALLBACK_MISSION_ID.coop);
    }
  });
});
