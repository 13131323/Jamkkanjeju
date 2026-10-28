/**
 * 그릴 수 있는 인증 사진 주소만 남긴다. 없으면 `undefined`.
 *
 * 화면은 `itemImgUrl ?? undefined`로 `null`만 걸러 넘기는데, 서버가 빈 문자열을 주면
 * 그것이 그대로 통과해 "사진 있음"이 된다 — 그러면 `<Image uri="">`가 아무것도 불러오지 못해
 * 스켈레톤이 영원히 반짝이고, 사용자에게는 남의 사진이 끝없이 로딩되는 것처럼 보인다.
 * 아직 올리지 않은 상태와 같게 다뤄야 "인증 사진 없음"이 제대로 보인다.
 *
 * **아직 올리지 않은 팀원이 정상 상태다** — 남의 인증 사진은 2초 폴링으로만 따라오므로,
 * 그 사람이 촬영하기 전까지 서버는 이 값을 비워 보낸다(계약상 `string | null`).
 *
 * 컴포넌트(.tsx)가 아니라 이 파일에 두는 이유는 react-native를 import하지 않는 순수 함수라야
 * 테스트에서 그대로 부를 수 있기 때문이다(RoleCard/styles.ts와 같은 자리).
 */
export function resolvePhotoUri(photoUri: string | null | undefined): string | undefined {
  if (photoUri === null || photoUri === undefined) return undefined;
  return photoUri.trim().length > 0 ? photoUri : undefined;
}
