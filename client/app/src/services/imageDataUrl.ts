/**
 * data URL 파싱.
 *
 * `saveImageToGallery.ts`에서 떼어 둔다 — 그쪽은 네이티브 모듈(파일 쓰기·갤러리)을 import하므로
 * 테스트 러너가 통째로 읽지 못한다. 판단이 들어 있는 이 부분만이라도 검증할 수 있게 나눈다
 * (`CharacterPhotoCapture/characterSource.ts`와 같은 이유).
 */

/**
 * `data:image/png;base64,....`에서 확장자와 본문을 가른다. 그 형식이 아니면 null.
 *
 * `s` 플래그가 필요하다 — base64 본문은 길어지면 줄바꿈이 섞일 수 있는데, 없으면 `.`이 거기서
 * 멈춰 본문이 잘린 채로 저장된다.
 */
export function parseImageDataUrl(dataUrl: string): { extension: string; base64: string } | null {
  const match = /^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl);
  if (match === null) return null;

  // `jpeg`는 파일 확장자로 `jpg`를 쓴다. 그 외에는 서브타입을 그대로 쓴다(png·webp)
  const subtype = match[1].toLowerCase();
  return { extension: subtype === 'jpeg' ? 'jpg' : subtype, base64: match[2] };
}

/**
 * 원격 이미지 주소에서 저장에 쓸 확장자를 고른다.
 *
 * 앱이 직접 내려받는 경로(엽서)는 data URL이 아니라 주소만 받는다. 갤러리에 넣을 임시 파일에
 * **확장자가 있어야** 기기가 이미지로 알아본다.
 *
 * 주소의 경로 끝에서만 읽는다 — 쿼리스트링(`?w=800&token=...`)에 점이 섞여도 거기서 확장자를
 * 주워 오면 안 된다. 아는 이미지 확장자가 아니면 `jpg`로 둔다(서버가 만드는 엽서가 JPEG다).
 */
const KNOWN_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

export function imageExtensionFromUrl(imageUrl: string): string {
  const path = imageUrl.split('?')[0].split('#')[0];
  const last = path.slice(path.lastIndexOf('/') + 1);
  const dot = last.lastIndexOf('.');
  if (dot < 0) return 'jpg';

  const extension = last.slice(dot + 1).toLowerCase();
  if (!KNOWN_IMAGE_EXTENSIONS.includes(extension)) return 'jpg';
  return extension === 'jpeg' ? 'jpg' : extension;
}
