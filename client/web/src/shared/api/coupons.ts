import { orvalClient } from './axios/instance';

/** 쿠폰 ID와 로그인 사용자로 식별한 획득 쿠폰을 사용 처리한다. */
export function markAcquiredCouponUsed(couponId: number) {
  return orvalClient<void>({ url: `/api/v2/coupons/${couponId}/use`, method: 'PATCH' });
}
