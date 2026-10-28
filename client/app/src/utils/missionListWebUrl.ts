/**
 * "근처에서 할 수 있는 보물 찾기 > 더보기"가 열 web 지도 경로를 만든다.
 *
 * 목록 화면은 web에 이미 있다(`web/src/widgets/map/ui/FilteredMissionModalCard.tsx`) —
 * 지금까지는 지도 위 필터 칩을 눌러야만 열렸는데, URL로도 같은 시트를 열 수 있게 파라미터를 붙인다.
 * `coupon=1`(couponWebUrl.ts)·`mode=treasure`와 같은 방식이다.
 *
 * web의 parseMissionListParam / parseEntryCoords와 짝이다 — 파라미터 이름을 바꾸면 양쪽을 함께 고쳐야 한다.
 */
export type NearbyMissionListType = 'treasure' | 'coop';

export interface NearbyMissionMapUrlParams {
  missionType: NearbyMissionListType;
  /**
   * 사용자 현재 좌표. 없으면 붙이지 않는다 — web은 그 경우 제주 중심을 기준으로 열고,
   * 목록의 거리도 그 기준으로 계산된다.
   *
   * 좌표를 URL로 넘기는 이유: 이 화면은 새 WebView라 web의 위치 스토어를 채우는 브릿지
   * (HomePage의 useLocationBridge)가 뜨지 않는다. 앱이 이미 들고 있는 좌표를 넘기지 않으면
   * "근처"가 제주 중심 기준이 된다.
   */
  coords: { lat: number; lng: number } | null;
}

export function buildNearbyMissionMapPath({ missionType, coords }: NearbyMissionMapUrlParams): string {
  const params = new URLSearchParams({ missions: missionType });

  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    params.set('lat', String(coords.lat));
    params.set('lng', String(coords.lng));
  }

  return `/map?${params.toString()}`;
}
