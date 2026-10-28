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
