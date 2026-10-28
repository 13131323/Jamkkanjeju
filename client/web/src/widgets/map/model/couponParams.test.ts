import { describe, expect, it } from 'vitest';
import { parseCouponParams } from './couponParams';

const params = (query: string) => new URLSearchParams(query);

describe('parseCouponParams', () => {
  it('필요한 값이 다 있으면 payload를 준다', () => {
    expect(
      parseCouponParams(
        params('coupon=1&couponLocation=%ED%83%90%EB%9D%BC%20%EC%86%8C%ED%92%88&couponPrice=1000&couponLocationId=44&couponAddress=%EC%A0%9C%EC%A3%BC%EC%8B%9C&couponImage=https%3A%2F%2Fex.com%2Fa.jpg'),
      ),
    ).toEqual({
      couponLocation: '탐라 소품',
      couponPrice: 1000,
      locationId: 44,
      locationAddress: '제주시',
      locationImageUrl: 'https://ex.com/a.jpg',
    });
  });

  it('coupon 플래그가 없으면 열지 않는다 — 일반 지도 진입을 건드리면 안 된다', () => {
    expect(parseCouponParams(params(''))).toBeNull();
    expect(parseCouponParams(params('mode=treasure'))).toBeNull();
    expect(parseCouponParams(params('couponLocation=탐라 소품&couponPrice=1000'))).toBeNull();
  });

  it('사용처가 없으면 열지 않는다', () => {
    expect(parseCouponParams(params('coupon=1&couponPrice=1000'))).toBeNull();
    expect(parseCouponParams(params('coupon=1&couponLocation=&couponPrice=1000'))).toBeNull();
  });

  it('금액을 숫자로 못 읽으면 열지 않는다', () => {
    expect(parseCouponParams(params('coupon=1&couponLocation=탐라 소품'))).toBeNull();
    expect(parseCouponParams(params('coupon=1&couponLocation=탐라 소품&couponPrice=abc'))).toBeNull();
  });

  it('0원·음수 금액은 버린다 — 빈 문자열이 Number(\'\')=0으로 통과하는 것도 함께 막는다', () => {
    expect(parseCouponParams(params('coupon=1&couponLocation=탐라 소품&couponPrice='))).toBeNull();
    expect(parseCouponParams(params('coupon=1&couponLocation=탐라 소품&couponPrice=0'))).toBeNull();
    expect(parseCouponParams(params('coupon=1&couponLocation=탐라 소품&couponPrice=-100'))).toBeNull();
  });

  it('주소·이미지는 없으면 null이다 — 일치 장소가 없는 쿠폰이 그렇다', () => {
    const parsed = parseCouponParams(params('coupon=1&couponLocation=탐라 소품&couponPrice=1000'));
    expect(parsed?.locationAddress).toBeNull();
    expect(parsed?.locationImageUrl).toBeNull();
  });

  it('빈 문자열로 온 주소·이미지도 null로 읽는다', () => {
    const parsed = parseCouponParams(params('coupon=1&couponLocation=탐라 소품&couponPrice=1000&couponAddress=&couponImage='));
    expect(parsed?.locationAddress).toBeNull();
    expect(parsed?.locationImageUrl).toBeNull();
  });

  it('장소 id가 없거나 정수가 아니면 null이다 — 시트는 열되 지도는 옮기지 않는다', () => {
    expect(parseCouponParams(params('coupon=1&couponLocation=탐라 소품&couponPrice=1000'))?.locationId).toBeNull();
    expect(parseCouponParams(params('coupon=1&couponLocation=탐라 소품&couponPrice=1000&couponLocationId='))?.locationId).toBeNull();
    expect(parseCouponParams(params('coupon=1&couponLocation=탐라 소품&couponPrice=1000&couponLocationId=abc'))?.locationId).toBeNull();
    expect(parseCouponParams(params('coupon=1&couponLocation=탐라 소품&couponPrice=1000&couponLocationId=1.5'))?.locationId).toBeNull();
  });

  it('장소 id가 있으면 숫자로 읽는다 — 금액과 달리 0도 유효한 id다', () => {
    expect(parseCouponParams(params('coupon=1&couponLocation=탐라 소품&couponPrice=1000&couponLocationId=44'))?.locationId).toBe(44);
    expect(parseCouponParams(params('coupon=1&couponLocation=탐라 소품&couponPrice=1000&couponLocationId=0'))?.locationId).toBe(0);
  });
});
