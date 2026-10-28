/**
 * 역할에서 만들어 내는 안내 문구.
 *
 * 서버가 `roleCards[].hint`·`pictureGuide`를 없애면서 이 두 줄은 클라이언트가 역할명과
 * 찾을 장소만으로 조립하게 됐다. 서버가 문구를 다시 주기 시작하면 여기가 통째로 사라진다.
 *
 * `coopMission.ts`가 아니라 별도 파일인 이유는 그 파일이 역할 일러스트를 `require`하기 때문이다 —
 * 이미지가 딸려 오면 테스트 러너가 PNG를 읽지 못해 문구 규칙조차 검증할 수 없다
 * (`CharacterPhotoCapture`의 `characterSource.ts`·`pendingNotice.ts`와 같은 이유로 뗐다).
 */

/**
 * 업로드 박스 위 안내 한 줄.
 *
 * 역할명만으로 만들 수 있는 문구라 서버 값이 다시 생기기 전까지 이걸 쓴다.
 * 문구가 비면 무엇을 찍어야 하는지 알 수 없다.
 */
export function roleVerifyHint(roleName: string): string {
  return `${roleName} 재료를 찾아 사진으로 인증해주세요.`;
}

/**
 * 촬영 화면 하단 패널의 대상 안내.
 *
 * 서버가 주는 `locationToFind`(찾을 장소 목록)가 촬영 중에 가장 필요한 정보라 그것을 한 줄로 잇는다 —
 * 카메라를 켠 뒤에는 역할 설명을 다시 볼 수 없다.
 *
 * **역할명을 앞에 붙인다**(사용자 지시). 촬영 헤더에는 보물찾기처럼 뒤로가기만 두기로 해서
 * 역할명이 들어갈 자리가 여기밖에 없다. 대신 장소는 {@link MAX_GUIDE_PLACES}곳까지만 잇는다 —
 * 역할명까지 붙은 뒤 장소가 셋 넘게 이어지면 안내가 두 줄을 넘겨 셔터 자리를 밀어낸다.
 */
const MAX_GUIDE_PLACES = 2;

export function rolePhotoGuide(roleName: string, locationToFind: string[]): string {
  const places = locationToFind.slice(0, MAX_GUIDE_PLACES).join(' · ');
  // 장소를 못 받았을 때 역할명만 덩그러니 두면 무엇을 하라는 문구인지 알 수 없다
  if (places.length === 0) return `${roleName} 재료를 찾아 찍어주세요`;
  return `${roleName} · ${places}`;
}
