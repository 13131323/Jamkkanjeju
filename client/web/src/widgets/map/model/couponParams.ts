/**
 * app이 넘긴 쿠폰 사용 시트 파라미터를 읽는다.
 *
 * 앱의 보물찾기 완료 화면에서 "사용하러 가기"를 누르면 WebView가 `/map?coupon=1&...`으로
 * 진입한다. `mode=treasure`와 같은 방식이다 — 새 WebView라 브릿지 postMessage로는
 * 초기 데이터를 받을 수 없고, 쿼리 파라미터가 유일한 전달 경로다.
 *
 * 쿠폰 값은 completion API가 이미 app에 준 것이라 web에서 다시 조회하지 않는다.
 */
export interface CouponParams {
  couponLocation: string;
  couponPrice: number;
  /** 사용처와 이름이 일치한 LOCATION의 id. 일치 장소가 없으면 null이고, 지도를 옮기지 않는다 */
  locationId: number | null;
  locationAddress: string | null;
  locationImageUrl: string | null;
}

/** URLSearchParams와 ReadonlyURLSearchParams가 공통으로 갖는 최소 형태 */
interface ParamsLike {
  get(name: string): string | null;
}

/**
 * 쿠폰 파라미터가 유효할 때만 payload를 준다.
 *
 * 사용처와 금액이 없으면 시트에 그릴 내용이 없어 열지 않는다 — 빈 시트가 지도를 덮는 것보다
 * 아무것도 열지 않는 편이 낫다. 금액은 문자열로 오므로 숫자로 못 읽히면(`price=abc`)
 * 같은 이유로 버린다.
 */
export function parseCouponParams(params: ParamsLike): CouponParams | null {
  if (params.get('coupon') !== '1') return null;

  const couponLocation = params.get('couponLocation');
  if (!couponLocation) return null;

  const rawPrice = params.get('couponPrice');
  if (rawPrice === null) return null;
  const couponPrice = Number(rawPrice);
  // 빈 문자열은 Number('')가 0이라 통과한다. 금액 0원 쿠폰은 없으므로 함께 막는다.
  if (!Number.isFinite(couponPrice) || couponPrice <= 0) return null;

  return {
    couponLocation,
    couponPrice,
    // 사용처와 이름이 일치하는 LOCATION이 없으면 app이 빈 값으로 보낸다
    locationId: parseLocationId(params.get('couponLocationId')),
    locationAddress: params.get('couponAddress') || null,
    locationImageUrl: params.get('couponImage') || null,
  };
}

/**
 * 장소 id는 없거나(일치 장소 없음) 정수다. 사용처·금액과 달리 없어도 시트는 열어야 하므로
 * 여기서 null로 접고, "지도를 그 장소로 옮길지"만 갈린다.
 */
function parseLocationId(raw: string | null): number | null {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
}
