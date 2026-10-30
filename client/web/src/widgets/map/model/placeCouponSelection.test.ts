import { describe, expect, it } from 'vitest';
import { selectPlaceCoupon } from './placeCouponSelection';

const usedAt = '2026-10-29T11:00:00';
const coupon = (couponId: number, used: string | null = null, couponPrice = 1000) => ({
  couponId, couponPrice, locationAddress: '제주시', usedAt: used,
});

describe('selectPlaceCoupon', () => {
  it('획득 쿠폰이 없으면 null이다', () => {
    expect(selectPlaceCoupon([])).toBeNull();
  });

  it('usedAt이 null인 쿠폰은 사용 가능하다', () => {
    const first = coupon(1);
    expect(selectPlaceCoupon([first])).toEqual({ coupon: first, allUsed: false });
  });

  it('사용 완료 쿠폰보다 미사용 쿠폰을 우선 선택한다', () => {
    const first = coupon(1, usedAt);
    const second = coupon(2, null, 2000);
    expect(selectPlaceCoupon([first, second])).toEqual({ coupon: second, allUsed: false });
  });

  it('모두 사용 완료면 첫 쿠폰을 선택하고 allUsed=true다', () => {
    const first = coupon(1, usedAt);
    expect(selectPlaceCoupon([first, coupon(2, usedAt)])).toEqual({ coupon: first, allUsed: true });
  });

  it('금액이 같아도 ID가 다른 쿠폰의 사용 상태를 합치지 않는다', () => {
    const first = coupon(1, usedAt);
    const second = coupon(2);
    expect(selectPlaceCoupon([first, second])).toEqual({ coupon: second, allUsed: false });
  });

  it('새 응답의 usedAt에 따라 선택 상태를 갱신한다', () => {
    expect(selectPlaceCoupon([coupon(1)])?.allUsed).toBe(false);
    expect(selectPlaceCoupon([coupon(1, usedAt)])?.allUsed).toBe(true);
  });
});
