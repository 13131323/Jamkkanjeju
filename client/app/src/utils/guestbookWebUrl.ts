/**
 * 방명록 작성 화면(web `/travel-note/write`)의 경로를 만든다.
 *
 * 화면은 web에 있다(`web/src/_pages/travel-note-write`). 새 WebView라 브릿지 postMessage로
 * 초기 데이터를 줄 수 없어서 쿼리 파라미터로 넘긴다 — couponWebUrl.ts·missionListWebUrl.ts와 같은 방식이다.
 *
 * web의 buildGuestbookWriteHref / parseGuestbookWriteParams와 짝이다.
 * **파라미터 이름을 바꾸면 양쪽을 함께 고쳐야 한다.**
 *
 * web이 값을 읽는 방식(TravelNoteWritePage):
 *   - `placeId`가 있으면 그 장소에 붙는 방명록(GENERAL)이 되고 장소명 입력칸이 잠긴다.
 *     그때만 `missionId`가 함께 저장된다.
 *   - `placeId`가 없으면 좌표만 가진 방명록(ROAD)이 되어 사용자가 장소명을 직접 적는다.
 *     이 경로에서 `lat`/`lng`가 실제로 저장되므로, 좌표를 들고 있다면 반드시 넘겨야 한다.
 *   - `missionTitle`·`missionType`은 web이 아직 읽지 않는다. 값이 있으면 함께 실어 두고
 *     (URL만 봐도 어느 미션에서 왔는지 알 수 있다) web이 쓰기 시작하면 그대로 동작한다.
 */

/** web의 GuestbookWriteMissionType과 같은 값. 문화 미션은 방명록 CTA가 없어 들어올 일이 없다 */
export type GuestbookMissionType = 'treasure' | 'coop';

export interface GuestbookWriteUrlParams {
  /** 방명록을 붙일 장소 id. 없으면 web이 장소명을 직접 입력받는다 */
  placeId: number | null;
  /** 장소명. placeId가 있을 때 입력칸을 채우는 값이다 */
  placeName: string | null;
  missionId: number | null;
  missionTitle: string | null;
  missionType: GuestbookMissionType | null;
  /**
   * 사용자 현재 좌표. placeId가 없는 방명록은 이 값이 곧 위치라 빠지면 좌표 없이 저장된다.
   * 권한 거부·측위 실패로 없을 수 있어 그때는 붙이지 않는다.
   */
  coords: { lat: number; lng: number } | null;
}

export function buildGuestbookWritePath({ placeId, placeName, missionId, missionTitle, missionType, coords }: GuestbookWriteUrlParams): string {
  const params = new URLSearchParams();

  // id는 0도 유효한 값이라 진위값으로 거르지 않는다(couponWebUrl의 locationId와 같은 이유)
  if (placeId !== null) params.set('placeId', String(placeId));
  if (placeName) params.set('placeName', placeName);
  if (missionId !== null) params.set('missionId', String(missionId));
  if (missionTitle) params.set('missionTitle', missionTitle);
  if (missionType) params.set('missionType', missionType);

  if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
    params.set('lat', String(coords.lat));
    params.set('lng', String(coords.lng));
  }

  const query = params.toString();

  // 파라미터가 하나도 없어도 화면은 열린다(사용자가 장소명을 직접 적는 방명록이 된다).
  // 빈 `?`를 남기지 않는 것도 web 빌더와 같다.
  return query ? `/travel-note/write?${query}` : '/travel-note/write';
}
