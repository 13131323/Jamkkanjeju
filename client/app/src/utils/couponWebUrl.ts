/**
 * 쿠폰 사용 시트를 띄울 web 지도 경로를 만든다.
 *
 * 화면은 web에 있다(`web/src/widgets/map/ui/CouponModalCard.tsx`). 새 WebView라 브릿지
 * postMessage로 초기 데이터를 줄 수 없어서, `mode=treasure`와 같이 쿼리 파라미터로 넘긴다.
 * 값은 completion API가 이미 app에 준 것이라 web이 다시 조회하지 않는다.
 *
 * web의 parseCouponParams와 짝이다 — 파라미터 이름을 바꾸면 양쪽을 함께 고쳐야 한다.
 */
export interface CouponWebUrlParams {
  couponLocation: string;
  couponPrice: number;
  /** 사용처와 이름이 일치한 LOCATION의 id. 일치 장소가 없으면 null */
  locationId: number | null;
  locationAddress: string | null;
  locationImageUrl: string | null;
}

export function buildCouponMapPath({ couponLocation, couponPrice, locationId, locationAddress, locationImageUrl }: CouponWebUrlParams): string {
  const params = new URLSearchParams({
    coupon: '1',
    couponLocation,
    couponPrice: String(couponPrice),
  });

  // 일치하는 장소가 없는 쿠폰은 id·주소·이미지가 null이다. 빈 파라미터를 붙이지 않는다 —
  // web은 빈 문자열도 null로 읽지만, URL에 남기면 로그에서 값이 있는 것처럼 보인다.
  //
  // locationId를 함께 넘기는 이유: web이 "이 쿠폰에 갈 장소가 있는지"를 주소 유무가 아니라
  // 서버 판정으로 알아야 한다. 주소는 TourAPI 조회 결과라 장소가 있어도 비어 있을 수 있다.
  if (locationId !== null) params.set('couponLocationId', String(locationId));
  if (locationAddress) params.set('couponAddress', locationAddress);
  if (locationImageUrl) params.set('couponImage', locationImageUrl);

  return `/map?${params.toString()}`;
}
