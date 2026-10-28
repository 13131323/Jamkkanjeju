import { describe, expect, it } from 'vitest';
import { buildCouponMapPath } from './couponWebUrl';

/**
 * web의 parseCouponParams와 짝이 되는 쪽. 파라미터 이름·인코딩이 어긋나면 시트가 열리지 않고
 * 사용자는 그냥 지도만 보게 되므로(에러가 나지 않는다) 여기서 못박아 둔다.
 */
describe('buildCouponMapPath', () => {
  it('coupon 플래그와 사용처·금액을 넣는다', () => {
    const path = buildCouponMapPath({ couponLocation: '탐라 소품', couponPrice: 1000, locationId: null, locationAddress: null, locationImageUrl: null });
    const query = new URLSearchParams(path.slice(path.indexOf('?') + 1));

    expect(path.startsWith('/map?')).toBe(true);
    expect(query.get('coupon')).toBe('1');
    expect(query.get('couponLocation')).toBe('탐라 소품');
    expect(query.get('couponPrice')).toBe('1000');
  });

  it('공백·한글이 섞인 사용처를 인코딩한다 — 그대로 넣으면 URL이 잘린다', () => {
    const path = buildCouponMapPath({ couponLocation: '탐라 현애원 소품샵', couponPrice: 1000, locationId: null, locationAddress: null, locationImageUrl: null });
    expect(path).not.toContain(' ');
    expect(new URLSearchParams(path.slice(path.indexOf('?') + 1)).get('couponLocation')).toBe('탐라 현애원 소품샵');
  });

  it('장소 id·주소·이미지가 있으면 함께 넣는다', () => {
    const path = buildCouponMapPath({
      couponLocation: '탐라 소품',
      couponPrice: 1000,
      locationId: 44,
      locationAddress: '서귀포시 성산읍 산성효자로114번길 131-1',
      locationImageUrl: 'https://example.com/a.jpg?x=1',
    });
    const query = new URLSearchParams(path.slice(path.indexOf('?') + 1));

    expect(query.get('couponLocationId')).toBe('44');
    expect(query.get('couponAddress')).toBe('서귀포시 성산읍 산성효자로114번길 131-1');
    // 이미지 URL 자체에 쿼리가 붙어 있어도 파라미터 경계가 깨지지 않아야 한다
    expect(query.get('couponImage')).toBe('https://example.com/a.jpg?x=1');
  });

  it('장소 id·주소·이미지가 없으면 파라미터를 붙이지 않는다', () => {
    const path = buildCouponMapPath({ couponLocation: '탐라 소품', couponPrice: 1000, locationId: null, locationAddress: null, locationImageUrl: null });
    expect(path).not.toContain('couponLocationId');
    expect(path).not.toContain('couponAddress');
    expect(path).not.toContain('couponImage');
  });

  it('locationId가 0이어도 넣는다 — 진위값으로 거르면 id 0인 장소가 사라진다', () => {
    const path = buildCouponMapPath({ couponLocation: '탐라 소품', couponPrice: 1000, locationId: 0, locationAddress: null, locationImageUrl: null });
    expect(new URLSearchParams(path.slice(path.indexOf('?') + 1)).get('couponLocationId')).toBe('0');
  });
});
