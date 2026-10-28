import { describe, expect, it } from 'vitest';
import {
  COUPON_CATEGORY_LABEL,
  formatCouponBenefit,
  formatNearbyMissionDistanceLabel,
  isRewardExhausted,
  resolveRewardBadgeLabel,
  toCouponUsageConditions,
  toNearbyMissionSummaries,
  toRewardCoupons,
  type NearbyTreasureMission,
  type ReceivedCoupon,
} from './completion';

/**
 * 완료 화면으로 갈지 결정하는 판정. 서버가 완료 여부를 직접 주지 않아
 * "남은 보상이 하나도 없다"로 대신 읽는다(API 문서의 호출 트리거).
 *
 * 세 종류를 OR로 잘못 묶으면 보상이 남았는데 완료 화면이 뜨고, 그 상태로
 * completion API를 부르면 409 TREASURE_ITEMS_REMAINING이 돌아온다.
 */
describe('isRewardExhausted', () => {
  it('세 종류 모두 null이면 소진으로 본다', () => {
    expect(isRewardExhausted({ arCharacter: null, point: null, coupon: null })).toBe(true);
  });

  it('하나라도 남아 있으면 소진이 아니다', () => {
    expect(isRewardExhausted({ arCharacter: { id: 1, name: '돌멩이', imageUrl: 'a.png' }, point: null, coupon: null })).toBe(false);
    expect(isRewardExhausted({ arCharacter: null, point: { amount: 300 }, coupon: null })).toBe(false);
    expect(isRewardExhausted({ arCharacter: null, point: null, coupon: { couponLocation: '탐라 소품', couponPrice: 1000 } })).toBe(false);
  });

  it('필드가 생략된 응답도 소진으로 본다 — 생성 타입이 optional이라 undefined로 온다', () => {
    expect(isRewardExhausted({})).toBe(true);
    expect(isRewardExhausted({ arCharacter: undefined, point: null, coupon: undefined })).toBe(true);
  });

  it('생략된 필드가 섞여도 남은 보상이 있으면 소진이 아니다', () => {
    expect(isRewardExhausted({ point: { amount: 300 } })).toBe(false);
  });

  it('remainingReward 자체가 없으면 소진으로 보지 않는다 — 응답 전 상태를 완료로 오해하면 안 된다', () => {
    expect(isRewardExhausted(undefined)).toBe(false);
    expect(isRewardExhausted(null)).toBe(false);
  });
});

describe('formatNearbyMissionDistanceLabel', () => {
  it('1km 이상은 소수 한 자리 km와 도보 분을 잇는다', () => {
    expect(formatNearbyMissionDistanceLabel(1200, 18)).toBe('1.2km · 도보 18분');
  });

  it('1km 미만은 m로 쓴다', () => {
    expect(formatNearbyMissionDistanceLabel(450, 7)).toBe('450m · 도보 7분');
  });

  it('0m도 유효한 거리다 — 값 없음으로 묻히면 안 된다', () => {
    expect(formatNearbyMissionDistanceLabel(0, 0)).toBe('0m · 도보 0분');
  });
});

/**
 * 디자인의 초록 배지는 "300P" 한 종류뿐인데 API는 보상 세 종류를 준다.
 * 포인트가 없는 미션에서 배지가 빈 칸으로 남지 않도록 대체 순서를 못박는다.
 */
describe('resolveRewardBadgeLabel', () => {
  it('포인트가 있으면 포인트를 쓴다', () => {
    expect(resolveRewardBadgeLabel({ arCharacter: null, point: { amount: 300, isReceived: false }, coupon: null })).toBe('300P');
  });

  it('천 단위는 구분자를 넣는다', () => {
    expect(resolveRewardBadgeLabel({ arCharacter: null, point: { amount: 12000, isReceived: false }, coupon: null })).toBe('12,000P');
  });

  it('포인트가 없으면 쿠폰 금액으로 대체한다', () => {
    expect(resolveRewardBadgeLabel({ arCharacter: null, point: null, coupon: { couponLocation: '탐라 소품', couponPrice: 1000, isReceived: false } })).toBe('1,000원 할인');
  });

  it('포인트·쿠폰이 모두 없으면 캐릭터 이름을 쓴다', () => {
    expect(resolveRewardBadgeLabel({ arCharacter: { id: 4, name: '오름 정령', imageUrl: 'a.png', isReceived: false }, point: null, coupon: null })).toBe('오름 정령');
  });

  it('보상이 아예 없으면 null — 호출부가 배지를 그리지 않는다', () => {
    expect(resolveRewardBadgeLabel({ arCharacter: null, point: null, coupon: null })).toBeNull();
  });
});

const nearbyFixture: NearbyTreasureMission = {
  missionId: 12,
  missionType: 'TREASURE',
  locationId: 31,
  missionTitle: '새별오름의 숨겨진 보물',
  representativeImageUrl: 'https://example.com/31.jpg',
  distanceMeter: 1200,
  durationMinutes: 16,
  rewardDetail: {
    arCharacter: { id: 4, name: '오름 정령', imageUrl: 'https://example.com/4.png', isReceived: false },
    point: { amount: 300, isReceived: false },
    coupon: null,
  },
};

describe('toNearbyMissionSummaries', () => {
  it('카드가 쓰는 형태로 옮긴다', () => {
    expect(toNearbyMissionSummaries([nearbyFixture])).toEqual([
      {
        missionId: 12,
        locationId: 31,
        title: '새별오름의 숨겨진 보물',
        distanceLabel: '1.2km · 도보 16분',
        rewardLabel: '300P',
        photoUrl: 'https://example.com/31.jpg',
      },
    ]);
  });

  it('대표 이미지가 없으면 null로 넘긴다 — 호출부가 폴백 이미지를 고른다', () => {
    const [summary] = toNearbyMissionSummaries([{ ...nearbyFixture, representativeImageUrl: null }]);
    expect(summary.photoUrl).toBeNull();
  });

  it('빈 목록은 빈 배열이다', () => {
    expect(toNearbyMissionSummaries([])).toEqual([]);
  });
});

/**
 * 쿠폰에는 서버가 주는 식별자가 없다(응답에 미션 id도 쿠폰 id도 없다).
 * 그런데 문서상 "같은 사용처·같은 금액"이 서로 다른 미션에서 나오면 별개 항목으로 유지되므로,
 * 목록 위치를 섞어 key를 만들지 않으면 React key가 겹친다.
 */
describe('toRewardCoupons', () => {
  const coupons: ReceivedCoupon[] = [
    { couponLocation: '탐라 소품', couponPrice: 1000, locationId: 44, locationAddress: '제주시 예시로 44', locationImageUrl: 'https://example.com/44.jpg' },
    { couponLocation: '탐라 소품', couponPrice: 1000, locationId: 44, locationAddress: '제주시 예시로 44', locationImageUrl: 'https://example.com/44.jpg' },
  ];

  it('사용처·금액이 같아도 서로 다른 key를 받는다', () => {
    const [first, second] = toRewardCoupons(coupons);
    expect(first.couponId).not.toBe(second.couponId);
  });

  it('첫째 줄은 고정 분류 문구, 둘째 줄이 서버가 준 가게 이름이다', () => {
    const [coupon] = toRewardCoupons(coupons);
    expect(coupon.categoryLabel).toBe(COUPON_CATEGORY_LABEL);
    expect(coupon.storeName).toBe('탐라 소품');
    expect(coupon.benefit).toBe('1,000원 할인');
  });

  it('분류 문구는 쿠폰이 달라도 같다 — 서버 값이 아니라 고정 문구다', () => {
    const [first, second] = toRewardCoupons([...coupons, { couponLocation: '다른 가게', couponPrice: 3000, locationId: null, locationAddress: null, locationImageUrl: null }]);

    expect(first.categoryLabel).toBe(second.categoryLabel);
    expect(COUPON_CATEGORY_LABEL).toBe('제주 인기 가게');
  });

  it('지도로 보낼 장소 정보를 함께 들고 간다', () => {
    const [coupon] = toRewardCoupons(coupons);
    expect(coupon.locationId).toBe(44);
    expect(coupon.locationAddress).toBe('제주시 예시로 44');
    expect(coupon.locationImageUrl).toBe('https://example.com/44.jpg');
  });

  it('일치하는 장소가 없으면 장소 정보가 모두 null이다 — 사용하러 가기를 막는 근거가 된다', () => {
    const [coupon] = toRewardCoupons([{ couponLocation: '이름만 있는 곳', couponPrice: 2000, locationId: null, locationAddress: null, locationImageUrl: null }]);
    expect(coupon.locationId).toBeNull();
    expect(coupon.locationAddress).toBeNull();
    expect(coupon.locationImageUrl).toBeNull();
  });
});

describe('formatCouponBenefit', () => {
  it('금액에 구분자를 넣고 할인을 붙인다', () => {
    expect(formatCouponBenefit(1000)).toBe('1,000원 할인');
    expect(formatCouponBenefit(500)).toBe('500원 할인');
    expect(formatCouponBenefit(15000)).toBe('15,000원 할인');
  });
});

/**
 * 사용조건 첫 줄만 쿠폰 금액을 쓰고 나머지는 모든 쿠폰이 공유하는 고정 문구다.
 * 디자인은 1,000원 쿠폰에 "2,000원 이상"으로 적혀 있어 배수 관계일 수 있는데,
 * 서버가 최소 결제액을 주지 않아 확정할 수 없다. 배수가 맞다면 이 함수만 고치면 된다.
 */
describe('toCouponUsageConditions', () => {
  it('첫 줄에 쿠폰 금액이 들어간다', () => {
    expect(toCouponUsageConditions(1000)[0]).toBe('1,000원 이상 부터 사용 가능합니다.');
  });

  it('나머지 줄은 금액과 무관하게 같다', () => {
    expect(toCouponUsageConditions(1000).slice(1)).toEqual(toCouponUsageConditions(9000).slice(1));
  });

  it('세 줄을 준다', () => {
    expect(toCouponUsageConditions(1000)).toHaveLength(3);
  });
});
