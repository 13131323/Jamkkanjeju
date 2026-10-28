import { isCouponUsed } from '@entities/coupon';
import type { PlaceReceivedCoupon } from '@entities/place';

export type PlaceCouponSelection = {
  coupon: PlaceReceivedCoupon;
  /** 이 장소의 쿠폰이 전부 사용 완료됐는지 — 마커를 흐리게 보여줄지 정하는 데 쓴다 */
  allUsed: boolean;
};

/**
 * 장소의 쿠폰 중 마커/모달에 보여줄 하나를 고른다. 여러 건이면 미사용 쿠폰 중 첫 번째를,
 * 전부 사용됐으면 첫 번째를 쓴다.
 *
 * key로 쓰는 couponLocation은 locationTitle이다 — receivedCoupons 자체엔 사용처 이름이 없지만,
 * 서버가 "쿠폰 사용처 이름과 같은 이름의 장소"에 이 쿠폰을 붙여준 것이라(ReceivedCouponResponse
 * 문서) 이 장소의 locationTitle이 곧 그 이름과 같다. 앱이 완료 화면에서 `/map?couponLocation=`으로
 * 넘기는 값도 같은 이름이라 usedCoupons의 key(couponStorageKey)가 두 진입 경로에서 항상 일치한다.
 */
export function selectPlaceCoupon(locationTitle: string, receivedCoupons: PlaceReceivedCoupon[]): PlaceCouponSelection | null {
  if (receivedCoupons.length === 0) return null;

  const unused = receivedCoupons.find((coupon) => !isCouponUsed(locationTitle, coupon.couponPrice));
  return { coupon: unused ?? receivedCoupons[0], allUsed: unused === undefined };
}
