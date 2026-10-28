import { describe, expect, it } from 'vitest';
// 인트로의 완료 판정. 진행 화면이 나갈 곳을 고를 때 **같은 함수**를 읽어야 두 화면이 어긋나지 않는다
import { isRewardExhausted } from '@packages/shared';
import {
  isTreasureRunComplete,
  mergeGrantedRewards,
  readApiErrorCode,
  resolveTreasureDescription,
  resolveTreasureLocationId,
  resolveTreasureProgressFailure,
  resolveTreasureRewardKind,
  resolveTreasureRewardLabel,
  resolveTreasureStartOutcome,
  toFoundTreasureIndexes,
  toPlaceDescription,
  toPlaceSummary,
  toTreasureSpots,
  withFoundTreasureIndex,
} from './treasureMission';

/** 라이브 서버(POST /api/v1/treasure-missions/1/progress) 응답의 treasureItems를 그대로 옮긴 값 */
const treasureItems = [
  { treasureIndex: 1, location: { lat: 33.24660230077295, lng: 126.55426514131284 }, isFound: false },
  { treasureIndex: 2, location: { lat: 33.24710394619541, lng: 126.55410492684577 }, isFound: false },
  { treasureIndex: 3, location: { lat: 33.246603973744044, lng: 126.55405632514814 }, isFound: false },
];

const arCharacter = { id: 8, name: '천지연 물방울', imageUrl: 'https://cdn.jamkkan-jeju.dev/ar/mulbangul.png' };
const coupon = { couponLocation: '서귀포 올레시장 분식', couponPrice: 3000 };

describe('resolveTreasureRewardKind', () => {
  it('순번을 서버의 지급 순서(AR 캐릭터 → 포인트 → 쿠폰)에 대응시킨다', () => {
    expect(resolveTreasureRewardKind(1)).toBe('CHARACTER');
    expect(resolveTreasureRewardKind(2)).toBe('POINT');
    expect(resolveTreasureRewardKind(3)).toBe('COUPON');
  });

  it('알려진 순서를 벗어난 번호는 null — 보물이 3개보다 많아도 화면이 깨지지 않는다', () => {
    expect(resolveTreasureRewardKind(4)).toBeNull();
    expect(resolveTreasureRewardKind(0)).toBeNull();
  });
});

describe('resolveTreasureDescription', () => {
  it('종류별 문구를 돌려준다', () => {
    expect(resolveTreasureDescription('CHARACTER')).toBe('AR 캐릭터와 함께 사진을 찍어보세요');
    expect(resolveTreasureDescription('POINT')).toBe('포인트가 적립되었어요');
    expect(resolveTreasureDescription('COUPON')).toBe('제휴 매장에서 사용할 수 있는 쿠폰이에요');
  });

  it('금액·캐릭터 이름을 말하지 않는다 — 모달은 지급 전에 뜨므로 사실을 알 수 없다', () => {
    for (const kind of ['CHARACTER', 'POINT', 'COUPON', null] as const) {
      const description = resolveTreasureDescription(kind);
      expect(description).not.toMatch(/\d/);
      expect(description).not.toContain('천원');
    }
  });

  it('종류가 없으면 중립 문구', () => {
    expect(resolveTreasureDescription(null)).toBe('미션 보상이 지급되었어요');
  });
});

describe('toTreasureSpots', () => {
  it('서버 좌표(lat/lng)를 화면 좌표(latitude/longitude)로 옮긴다', () => {
    const spots = toTreasureSpots(treasureItems);

    expect(spots).toHaveLength(3);
    expect(spots[0]).toEqual({
      treasureIndex: 1,
      treasureType: 'CHARACTER',
      coords: { latitude: 33.24660230077295, longitude: 126.55426514131284 },
      description: 'AR 캐릭터와 함께 사진을 찍어보세요',
    });
  });

  it('treasureIndex 오름차순으로 정렬한다 — 순번이 라벨과 보상 종류 대응에 모두 쓰인다', () => {
    const shuffled = [treasureItems[2], treasureItems[0], treasureItems[1]];

    expect(toTreasureSpots(shuffled).map((spot) => spot.treasureIndex)).toEqual([1, 2, 3]);
    expect(toTreasureSpots(shuffled).map((spot) => spot.treasureType)).toEqual(['CHARACTER', 'POINT', 'COUPON']);
  });

  it('빈 목록이면 빈 배열 — 시작 응답을 기다리는 동안의 상태다', () => {
    expect(toTreasureSpots([])).toEqual([]);
  });
});

describe('toFoundTreasureIndexes', () => {
  it('이어하기 응답의 isFound만 골라낸다', () => {
    const resumed = [{ ...treasureItems[0], isFound: true }, treasureItems[1], { ...treasureItems[2], isFound: true }];

    expect(toFoundTreasureIndexes(resumed)).toEqual([1, 3]);
  });

  it('아무것도 못 찾았으면 빈 배열', () => {
    expect(toFoundTreasureIndexes(treasureItems)).toEqual([]);
  });
});

describe('mergeGrantedRewards', () => {
  it('여러 응답에 나뉘어 온 보상을 하나로 모은다 — 완료 화면이 세 줄을 보여줘야 한다', () => {
    // 라이브 서버 1회차: 1번째 보물 → AR 캐릭터, 2번째 → 포인트, 3번째(완료) → 쿠폰
    let accumulated = mergeGrantedRewards(null, { arCharacter, point: null, coupon: null });
    accumulated = mergeGrantedRewards(accumulated, { arCharacter: null, point: 150, coupon: null });
    accumulated = mergeGrantedRewards(accumulated, { arCharacter: null, point: null, coupon });

    expect(accumulated).toEqual({ arCharacter, point: 150, coupon });
  });

  it('나중 응답의 null이 이미 받은 보상을 지우지 않는다', () => {
    const accumulated = mergeGrantedRewards({ arCharacter, point: 150, coupon: null }, { arCharacter: null, point: null, coupon: null });

    expect(accumulated).toEqual({ arCharacter, point: 150, coupon: null });
  });

  it('포인트 0은 지급된 값이라 그대로 남는다 — falsy 검사를 쓰면 사라진다', () => {
    expect(mergeGrantedRewards(null, { point: 0 }).point).toBe(0);
    expect(mergeGrantedRewards({ point: 0 }, { arCharacter }).point).toBe(0);
  });

  it('아무것도 지급되지 않아도 객체를 돌려준다 — null은 완료 화면에서 "아직 모른다"로 읽힌다', () => {
    expect(mergeGrantedRewards(null, null)).toEqual({ arCharacter: null, point: null, coupon: null });
  });

  it('이번 응답이 이미 받은 항목을 다시 주면 새 값으로 갱신한다', () => {
    const nextCoupon = { couponLocation: '하효 감귤빵집', couponPrice: 3000 };

    expect(mergeGrantedRewards({ coupon }, { coupon: nextCoupon }).coupon).toEqual(nextCoupon);
  });
});

describe('readApiErrorCode', () => {
  it('axios 에러 바디의 code를 꺼낸다', () => {
    expect(readApiErrorCode({ response: { data: { code: 'TREASURE_ITEM_ALREADY_FOUND' } } })).toBe('TREASURE_ITEM_ALREADY_FOUND');
  });

  it('형태가 다르면 undefined — 네트워크 실패는 응답 자체가 없다', () => {
    expect(readApiErrorCode(undefined)).toBeUndefined();
    expect(readApiErrorCode(new Error('network'))).toBeUndefined();
    expect(readApiErrorCode({ response: { data: 'oops' } })).toBeUndefined();
    expect(readApiErrorCode({ response: { data: { code: 404 } } })).toBeUndefined();
  });
});

describe('resolveTreasureProgressFailure', () => {
  it('409 TREASURE_ITEM_ALREADY_FOUND는 목록만 맞추고 진행을 이어간다', () => {
    expect(resolveTreasureProgressFailure({ response: { data: { code: 'TREASURE_ITEM_ALREADY_FOUND' } } })).toBe('already-found');
  });

  it('404 TREASURE_MISSION_PROGRESS_NOT_FOUND는 이어갈 진행도가 없다는 뜻이다', () => {
    expect(resolveTreasureProgressFailure({ response: { data: { code: 'TREASURE_MISSION_PROGRESS_NOT_FOUND' } } })).toBe('progress-gone');
  });

  it('그 밖의 실패는 재시도로 남긴다', () => {
    expect(resolveTreasureProgressFailure({ response: { data: { code: 'TREASURE_ITEM_NOT_FOUND' } } })).toBe('retryable');
    expect(resolveTreasureProgressFailure(new Error('network'))).toBe('retryable');
  });
});

describe('withFoundTreasureIndex', () => {
  it('중복 없이 오름차순으로 더한다', () => {
    expect(withFoundTreasureIndex([1, 3], 2)).toEqual([1, 2, 3]);
    expect(withFoundTreasureIndex([1, 2], 2)).toEqual([1, 2]);
  });

  it('원본을 바꾸지 않는다 — 스토어 상태를 제자리에서 수정하면 리렌더가 걸리지 않는다', () => {
    const found = [1];
    withFoundTreasureIndex(found, 2);

    expect(found).toEqual([1]);
  });
});

describe('isTreasureRunComplete', () => {
  it('서버가 준 개수를 다 채우면 완료다', () => {
    expect(isTreasureRunComplete(3, 3)).toBe(true);
    expect(isTreasureRunComplete(2, 3)).toBe(false);
  });

  it('시작 응답 전(개수 0)에는 완료로 보지 않는다 — 빈 진행도가 완료로 판정되면 안 된다', () => {
    expect(isTreasureRunComplete(0, 0)).toBe(false);
  });
});

describe('resolveTreasureLocationId', () => {
  const base = { locationTitle: '오구포구', locationAddress: '제주시 예시로 1', lat: 33.2465, lng: 126.554 };

  it('서버가 준 locationId를 그대로 쓴다', () => {
    expect(resolveTreasureLocationId({ ...base, locationId: 7 })).toBe(7);
  });

  it('필드가 빠진 응답(낡은 서버·목 데이터)은 null — 화면이 죽지 않고 장소 설명·상세보기만 감춘다', () => {
    expect(resolveTreasureLocationId(base as never)).toBeNull();
  });

  it('유효하지 않은 값은 null로 막는다 — 잘못된 id로 조회하면 404가 난다', () => {
    expect(resolveTreasureLocationId({ ...base, locationId: 0 })).toBeNull();
    expect(resolveTreasureLocationId({ ...base, locationId: -3 })).toBeNull();
    expect(resolveTreasureLocationId({ ...base, locationId: 1.5 })).toBeNull();
    expect(resolveTreasureLocationId({ ...base, locationId: '7' } as never)).toBeNull();
    expect(resolveTreasureLocationId({ ...base, id: null } as never)).toBeNull();
  });
});

describe('toPlaceSummary', () => {
  it('한도 안에 들어오면 말줄임표 없이 그대로 쓴다', () => {
    expect(toPlaceSummary('해녀와 노을이 머무는 포구', 20)).toBe('해녀와 노을이 머무는 포구');
  });

  it('한도를 넘으면 단어 중간이 아니라 마지막 공백에서 자르고 말줄임표를 붙인다', () => {
    const summary = toPlaceSummary('성산일출봉은 제주 동쪽 끝에 솟은 분화구예요', 20);

    expect(summary?.endsWith('…')).toBe(true);
    // 자른 위치가 단어 경계여야 한다 — 말줄임표 앞이 공백으로 끝나지 않는다
    expect(summary).toBe('성산일출봉은 제주 동쪽 끝에 솟은…');
    expect(summary!.length).toBeLessThanOrEqual(21);
  });

  it('줄바꿈·연속 공백이 섞인 TourAPI 설명을 한 줄로 눌러 준다', () => {
    expect(toPlaceSummary('  포구가\n\n  넓어요  ', 20)).toBe('포구가 넓어요');
  });

  it('한도 안에 공백이 없는 긴 한 단어는 글자 수로 자른다', () => {
    const summary = toPlaceSummary('가'.repeat(40), 20);

    expect(summary).toBe(`${'가'.repeat(20)}…`);
  });

  it('설명이 없으면 null — 없는 소개를 지어내지 않는다', () => {
    expect(toPlaceSummary(null, 20)).toBeNull();
    expect(toPlaceSummary(undefined, 20)).toBeNull();
    expect(toPlaceSummary('   ', 20)).toBeNull();
  });
});

describe('resolveTreasureRewardLabel', () => {
  it('캐릭터는 서버가 준 이름을 붙인다', () => {
    expect(resolveTreasureRewardLabel('CHARACTER', { arCharacter: { id: 1, name: '보물이', imageUrl: 'https://x/a.png' } })).toBe('AR 캐릭터 보물이');
  });

  it('포인트·쿠폰은 금액을 천 단위로 끊는다', () => {
    expect(resolveTreasureRewardLabel('POINT', { point: 3000 })).toBe('3,000포인트');
    expect(resolveTreasureRewardLabel('COUPON', { coupon: { couponLocation: '카페', couponPrice: 5000 } })).toBe('5,000원 쿠폰');
  });

  it('보상 정보가 아직 없으면 종류만 말한다 — 미션 홈 응답이 늦을 수 있다', () => {
    expect(resolveTreasureRewardLabel('CHARACTER', null)).toBe('AR 캐릭터');
    expect(resolveTreasureRewardLabel('POINT', {})).toBe('포인트');
    expect(resolveTreasureRewardLabel('COUPON', undefined)).toBe('쿠폰');
  });

  it('종류를 모르는 보물은 보상이라고만 한다', () => {
    expect(resolveTreasureRewardLabel(null, { point: 100 })).toBe('보상');
  });
});

describe('resolveTreasureStartOutcome', () => {
  it('진행 중인 진행도를 돌려받으면 그대로 사냥 화면을 그린다', () => {
    expect(resolveTreasureStartOutcome('IN_PROGRESS', false, false)).toBe('play');
    expect(resolveTreasureStartOutcome('IN_PROGRESS', false, true)).toBe('play');
  });

  it('이미 끝난 진행도를 돌려받으면 사냥 화면을 그리지 않는다 — 3/3 지도에 갇히거나 404까지 걸어가게 된다', () => {
    expect(resolveTreasureStartOutcome('COMPLETED', false, true)).toBe('already-complete');
    expect(resolveTreasureStartOutcome('COMPLETED', false, false)).not.toBe('play');
  });

  it('사진만 찍으러 들어온 경로(?start=photo)는 COMPLETED가 정상이다 — 되돌려 보내면 촬영을 할 수 없다', () => {
    expect(resolveTreasureStartOutcome('COMPLETED', true, true)).toBe('play');
    expect(resolveTreasureStartOutcome('COMPLETED', true, false)).toBe('play');
    expect(resolveTreasureStartOutcome('IN_PROGRESS', true, false)).toBe('play');
  });

  it('모르는 상태값은 진행 중으로 본다 — 서버가 상태를 늘려도 이어하던 미션이 막히지 않는다', () => {
    expect(resolveTreasureStartOutcome('', false, false)).toBe('play');
    expect(resolveTreasureStartOutcome('PAUSED', false, false)).toBe('play');
  });

  /**
   * 되먹임 회귀 방지.
   *
   * 인트로는 진행도 상태를 알 수 없어 "남은 보상이 모두 소진됐는지"로 완료를 판정한다. 그 판정이
   * 거짓인데 진행 화면이 인트로로 되돌리면, 인트로는 "미션 시작하기"를 다시 보여주고 그 버튼이
   * 같은 응답을 불러 또 되돌아온다 — 무한 반복이라 사용자 눈에는 버튼이 죽은 것으로 보인다.
   * 그래서 인트로가 완료로 보지 않는 동안에는 **인트로로 되돌리지 않는다**.
   */
  it('인트로가 아직 완료로 보지 않으면(남은 보상이 있으면) 인트로로 되돌리지 않는다 — 시작하기 무한 되먹임', () => {
    expect(resolveTreasureStartOutcome('COMPLETED', false, false)).toBe('finished');
  });

  it('중단으로 끝난 진행도가 그 경우다 — 서버는 COMPLETED인데 못 받은 보상이 남아 인트로는 미완료로 본다', () => {
    // 보물을 하나도 못 찾고 "포기 할래요"를 누른 회차: 세 보상이 그대로 남아 isRewardExhausted가 거짓이다
    const introComplete = isRewardExhausted({ arCharacter, point: 150, coupon });
    expect(introComplete).toBe(false);
    expect(resolveTreasureStartOutcome('COMPLETED', false, introComplete)).toBe('finished');
  });

  it('셋 다 찾아 보상을 모두 받은 회차는 인트로가 완료 화면을 그릴 수 있으므로 인트로로 되돌린다', () => {
    const introComplete = isRewardExhausted({ arCharacter: null, point: null, coupon: null });
    expect(introComplete).toBe(true);
    expect(resolveTreasureStartOutcome('COMPLETED', false, introComplete)).toBe('already-complete');
  });
});

describe('toPlaceDescription', () => {
  it('줄바꿈·연속 공백만 누르고 자르지는 않는다 — 카드가 눌러서 전문을 편다', () => {
    const long = `${'제주 설명 '.repeat(40)}`;
    const result = toPlaceDescription(`  앞\n\n중간   뒤  `);

    expect(result).toBe('앞 중간 뒤');
    expect(toPlaceDescription(long)?.length).toBe(long.trim().length);
  });

  it('설명이 없거나 공백뿐이면 null이다', () => {
    expect(toPlaceDescription(null)).toBeNull();
    expect(toPlaceDescription(undefined)).toBeNull();
    expect(toPlaceDescription('   ')).toBeNull();
  });
});
