/**
 * 캡처한 파일을 "RN이 멀티파트 파일 파트로 알아보는 모양"으로 감싼다.
 *
 * `CharacterPhotoCapture`는 파일을 만들어 주고 **어디로 올릴지는 모른다**(onUpload로 주입받는다).
 * 그래서 이 헬퍼가 공용 폴더에 있다 — 엔드포인트는 호출부마다 달라도, "RN에서 file:// 을
 * 어떻게 올리느냐"는 항상 같기 때문이다. 호출부가 각자 이 모양을 다시 만들면 아래 함정도
 * 각자 다시 밟게 된다.
 */

/**
 * RN의 FormData가 "파일 파트"로 인식하는 값의 모양.
 *
 * react-native/Libraries/Network/FormData.js의 값 타입 자체가 `string | { name?, type?, uri }`다.
 * 브라우저처럼 Blob을 넣는 경로가 아니라, uri를 담은 평범한 객체를 넣으면 네이티브가 그 파일을
 * 스트리밍해서 멀티파트 본문으로 만든다(NetworkingModule.kt의 constructMultipartBody).
 *
 * `type`은 선택 항목이 아니다 — 없으면 Android가 "Binary FormData part needs a content-type
 * header."로 요청을 거절한다(같은 함수). 그래서 세 필드를 모두 필수로 둔다.
 */
export interface ReactNativeFilePart {
  uri: string;
  name: string;
  type: string;
}

/**
 * 업로드 파일의 이름·타입.
 *
 * 서버는 원본 파일명을 무시하고 **파일 내용의 시그니처**로 실제 형식을 판별해 확장자를 정한다
 * (app/common/images.py). 그래서 이름은 형식만 어긋나지 않게 두면 되고, 실제로 올라가는 건
 * captureRef가 `format: 'jpg'`로 만든 JPEG다.
 *
 * 즉 이 상수는 `CharacterPhotoCapture`가 JPEG로 캡처한다는 사실에 묶여 있다 —
 * 캡처 format을 바꾸는 날에는 여기도 함께 바뀌어야 한다.
 */
export const CAPTURE_UPLOAD_FILE_NAME = 'picture.jpg';
export const CAPTURE_UPLOAD_FILE_TYPE = 'image/jpeg';

/**
 * 캡처 결과 URI를 파일 파트로 만든다.
 *
 * orval이 만든 요청 타입의 파일 필드는 OpenAPI multipart 스키마에서 온 `Blob`이다. 그런데 RN에는
 * file:// URI로 Blob을 만드는 경로가 없다 — 그래서 호출부에서 `as unknown as Blob` 한 줄이
 * 필요하고, 그 캐스팅은 **호출부에 남겨 둔다**. 생성 타입을 넓히면 다른 호출부에서 진짜 Blob이
 * 아닌 값이 조용히 통과하기 때문이다.
 */
export function toReactNativeFilePart(uri: string): ReactNativeFilePart {
  return { uri, name: CAPTURE_UPLOAD_FILE_NAME, type: CAPTURE_UPLOAD_FILE_TYPE };
}
