/**
 * 앱이 없는 사람을 보낼 곳 — 원스토어.
 *
 * 이 앱은 구글플레이가 아니라 **원스토어로 배포한다**(`app/README.md`의 "빌드 (EAS)").
 * 그래서 `market://details?id=…`(플레이스토어 전용)이나 `play.google.com` 주소는 쓰지 않는다.
 */

/**
 * 원스토어 상품 상세의 공식 짧은 주소 형식.
 *
 * 원스토어는 **패키지명이 아니라 상품ID(PID)** 로 상세 페이지를 가리킨다
 * (원스토어 개발자센터 "앱링크 레퍼런스": URL 스킴 `onestore://common/product/{product id}`의
 * product id가 "숫자 10자리 PID"라고 명시돼 있고, 짧은 주소도 `https://onesto.re/{PID}` 형태다.
 * 예: `https://onesto.re/0000747601`).
 *
 * PID는 개발자센터의 상품ID(AID, `OA00…`)에서 앞의 `OA`를 `00`으로 바꾼 10자리 숫자다.
 *
 * `onestore://` 스킴 대신 https 짧은 주소를 쓰는 이유:
 * - 원스토어 클라이언트가 깔려 있으면 이 주소가 알아서 앱 안의 상세 페이지로 넘어간다.
 * - 깔려 있지 않아도 모바일 웹 상세 페이지가 떠서 "아무 일도 일어나지 않는" 막다른 길이 없다.
 *   커스텀 스킴은 클라이언트가 없으면 그대로 실패한다.
 */
const ONE_STORE_SHORT_URL_ORIGIN = 'https://onesto.re';

/**
 * 원스토어 모바일 웹 통합검색. PID를 모를 때의 폴백이다.
 *
 * 상세 페이지만큼 좋지는 않지만 **막다른 길이 아니다** — 앱 이름으로 검색된 목록에서
 * 사용자가 한 번 더 누르면 설치까지 간다. 잘못된 PID로 만든 링크가 404를 띄우는 것보다 낫다.
 */
const ONE_STORE_SEARCH_URL = 'https://m.onestore.co.kr/ko-kr/search/integrateSearch.omp';

/** 검색 폴백에 쓰는 앱 이름. `app/app.json`의 `expo.name`과 같다 */
const APP_NAME = '잠깐제주';

/**
 * 이 앱의 원스토어 상품ID(PID).
 *
 * 스토어 콘솔에만 있는 값이라 저장소의 다른 무엇으로도 유도할 수 없다 — 사용자가 직접 확인해 준
 * 값을 그대로 둔다. 상품을 새로 등록하는 등으로 바뀌면 여기만 고치고 web을 다시 배포하면 되고,
 * **앱 재빌드는 필요 없다**(이 값은 web 랜딩 페이지에서만 쓰인다).
 *
 * 다시 확인하는 법 (둘 중 아무거나):
 * 1. 원스토어 개발자센터 → 해당 상품 → 상품ID(`OA00xxxxxxxx`)에서 앞 `OA`를 `00`으로 바꾼다.
 * 2. 원스토어 앱에서 잠깐제주 상세를 열고 "공유"를 누르면 `https://onesto.re/00000xxxxx`가 나온다.
 *    끝의 10자리 숫자가 PID다.
 *
 * 형식이 어긋나면(자리수·비숫자) 아래 buildOneStoreUrl이 조용히 검색 폴백으로 내려간다 —
 * 잘못된 PID로 만든 404 링크보다는 검색 목록이 낫기 때문이다.
 */
export const ONE_STORE_PRODUCT_ID: string | null = '0001008742';

/** 원스토어 PID는 숫자 10자리다. 그 밖의 값은 상세 페이지로 이어지지 않으므로 폴백을 쓴다 */
const PRODUCT_ID_PATTERN = /^\d{10}$/;

/**
 * 설치 버튼이 여는 주소.
 *
 * PID가 있으면 상품 상세, 없거나 형식이 틀리면 앱 이름으로 검색한다.
 * **어느 쪽이든 항상 문자열을 돌려준다** — 버튼이 사라지거나 죽은 링크가 되는 갈래를 만들지 않는다.
 */
export function buildOneStoreUrl(productId: string | null | undefined = ONE_STORE_PRODUCT_ID): string {
  const pid = productId?.trim();

  if (pid && PRODUCT_ID_PATTERN.test(pid)) {
    return `${ONE_STORE_SHORT_URL_ORIGIN}/${pid}`;
  }

  return `${ONE_STORE_SEARCH_URL}?integrateQuery=${encodeURIComponent(APP_NAME)}`;
}
