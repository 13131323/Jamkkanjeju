import type { PlaceReceivedCoupon } from '@entities/place';

export type PlaceCouponSelection = {
  coupon: PlaceReceivedCoupon;
  /** 이 장소의 쿠폰이 전부 사용 완료됐는지 — 마커를 흐리게 보여줄지 정하는 데 쓴다 */
  allUsed: boolean;
};

/**
 * 장소의 쿠폰 중 마커/모달에 보여줄 하나를 고른다. 여러 건이면 미사용 쿠폰 중 첫 번째를,
 * 전부 사용됐으면 첫 번째를 쓴다.
 * 사용 여부는 서버가 반환한 usedAt으로만 판단하며 같은 금액의 다른 쿠폰도 각각 구분한다.
 */
export function selectPlaceCoupon(receivedCoupons: PlaceReceivedCoupon[]): PlaceCouponSelection | null {
  if (receivedCoupons.length === 0) return null;

  const unused = receivedCoupons.find((coupon) => coupon.usedAt === null);
  return { coupon: unused ?? receivedCoupons[0], allUsed: unused === undefined };
}
