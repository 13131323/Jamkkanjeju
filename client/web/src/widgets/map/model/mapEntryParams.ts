/**
 * app이 새 WebView로 `/map`을 열 때 붙이는, 쿠폰 이외의 진입 파라미터를 읽는다.
 *
 * `coupon=1`(couponParams.ts)·`mode=treasure`(MapView)와 같은 결이다 — 새 WebView라 브릿지
 * postMessage로 초기 상태를 받을 수 없고, 쿼리 파라미터가 유일한 전달 경로다.
 */
import type { PlaceFilter } from '@features/place-filter';
import type { Coordinates } from '@shared/config/geo';

/** URLSearchParams와 ReadonlyURLSearchParams가 공통으로 갖는 최소 형태 (couponParams.ts와 같다) */
interface ParamsLike {
  get(name: string): string | null;
}

/** `missions` 파라미터가 가리키는 미션 목록 종류. 필터 칩 상태(PlaceFilter)와 같은 값을 쓴다 */
export type MissionListParam = Extract<PlaceFilter, 'treasure' | 'coop'>;

/**
 * `?missions=treasure` → 진입 즉시 근처 보물찾기 목록 시트를 연다.
 *
 * 값을 필터 칩 상태(PlaceFilter)와 같은 문자열로 둔 이유는, 이 파라미터로 들어와도 칩 클릭과
 * **같은 상태**(useFilterState의 filter + useMapModal의 filteredMission)를 쓰기 위해서다.
 * 목록을 여는 상태를 두 벌로 만들면 칩 배지와 시트 내용이 어긋난다.
 *
 * 'all'은 목록 시트가 없는 필터라 받지 않는다 — 알 수 없는 값과 같이 null로 접는다.
 */
export function parseMissionListParam(params: ParamsLike): MissionListParam | null {
  const raw = params.get('missions');
  return raw === 'treasure' || raw === 'coop' ? raw : null;
}

/**
 * `?lat=&lng=` → 앱이 알고 있는 사용자 좌표.
 *
 * 새 WebView로 `/map`을 직접 열면 위치 스토어를 채우는 쪽(HomePage의 useLocationBridge)이
 * 없어서 좌표가 비고, 지도는 제주 중심(JEJU_CENTER)에서 열린다. "근처 미션"처럼 거리 계산이
 * 화면의 본문인 진입에서는 그 상태로 열 수 없다.
 *
 * 범위 검증을 하지 않는 이유: 제주 안/밖 판단은 이미 resolveDisplayLocation이 한다. 여기서는
 * 좌표로 읽히지 않는 값(빈 문자열·문자·NaN)만 거른다 — Number('')=0이 통과해 지도가 적도로
 * 날아가는 것을 막는 것이 요점이다.
 */
export function parseEntryCoords(params: ParamsLike): Coordinates | null {
  const rawLat = params.get('lat');
  const rawLng = params.get('lng');
  if (!rawLat || !rawLng) return null;

  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}
