import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markCouponUsed } from '@entities/coupon';
// resetSessionUsedCoupons는 테스트 전용이라 공개 배럴(@entities/coupon)에 없다 — usedCoupons.test.ts와 같은 방식으로 모듈을 직접 가져온다.
import { resetSessionUsedCoupons } from '@entities/coupon/model/usedCoupons';
import { selectPlaceCoupon } from './placeCouponSelection';

// usedCoupons.test.ts와 같은 이유(vitest 환경이 node)로 localStorage를 흉내낸다.
function stubStorage(store: Map<string, string>) {
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
  });
}

beforeEach(() => {
  stubStorage(new Map());
  resetSessionUsedCoupons();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('selectPlaceCoupon', () => {
  it('쿠폰이 없으면 null이다', () => {
    expect(selectPlaceCoupon('탐라 소품', [])).toBeNull();
  });

  it('쿠폰이 하나면 그대로 쓴다', () => {
    const coupon = { couponPrice: 1000, locationAddress: '제주시' };
    expect(selectPlaceCoupon('탐라 소품', [coupon])).toEqual({ coupon, allUsed: false });
  });

  it('여러 건이면 미사용 쿠폰 중 첫 번째를 쓴다', () => {
    const used = { couponPrice: 1000, locationAddress: '제주시' };
    const unused = { couponPrice: 2000, locationAddress: '제주시' };
    markCouponUsed('탐라 소품', used.couponPrice);

    expect(selectPlaceCoupon('탐라 소품', [used, unused])).toEqual({ coupon: unused, allUsed: false });
  });

  it('전부 사용됐으면 첫 번째를 쓰고 allUsed=true다', () => {
    const first = { couponPrice: 1000, locationAddress: '제주시' };
    const second = { couponPrice: 2000, locationAddress: '제주시' };
    markCouponUsed('탐라 소품', first.couponPrice);
    markCouponUsed('탐라 소품', second.couponPrice);

    expect(selectPlaceCoupon('탐라 소품', [first, second])).toEqual({ coupon: first, allUsed: true });
  });

  it('사용처 이름(locationTitle)이 key라 이름이 다르면 별개로 취급한다', () => {
    const coupon = { couponPrice: 1000, locationAddress: '제주시' };
    markCouponUsed('탐라 소품', coupon.couponPrice);

    // 다른 장소 이름으로 같은 금액 쿠폰을 조회하면 사용 완료로 보지 않는다
    expect(selectPlaceCoupon('성산 감귤 공방', [coupon])).toEqual({ coupon, allUsed: false });
  });
});
