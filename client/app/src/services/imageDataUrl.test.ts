import { describe, expect, it } from 'vitest';
import { imageExtensionFromUrl, parseImageDataUrl } from './imageDataUrl';

/**
 * data URL 파싱만 따로 검증한다.
 *
 * 저장 자체는 네이티브 모듈(파일 쓰기 · 갤러리)이라 여기서 돌릴 수 없다. 반대로 파싱은
 * "확장자를 어떻게 정하는가"라는 판단이 들어 있어 틀리면 갤러리에 엉뚱한 확장자로 남는다.
 */
describe('parseImageDataUrl', () => {
  it('png의 서브타입을 확장자로 쓴다', () => {
    expect(parseImageDataUrl('data:image/png;base64,AAAA')).toEqual({ extension: 'png', base64: 'AAAA' });
  });

  it('jpeg는 확장자 jpg로 바꾼다', () => {
    // 갤러리·파일 탐색기가 기대하는 확장자는 jpeg가 아니라 jpg다
    expect(parseImageDataUrl('data:image/jpeg;base64,AAAA')?.extension).toBe('jpg');
  });

  it('본문에 줄바꿈이 섞여도 끝까지 읽는다', () => {
    // base64는 길어지면 줄바꿈이 들어갈 수 있다. `.`이 줄바꿈을 넘지 못하면 본문이 잘린다
    expect(parseImageDataUrl('data:image/png;base64,AA\nBB')?.base64).toBe('AA\nBB');
  });

  it('이미지가 아니거나 base64가 아니면 null', () => {
    expect(parseImageDataUrl('data:text/html;base64,AAAA')).toBeNull();
    expect(parseImageDataUrl('data:image/png,AAAA')).toBeNull();
    expect(parseImageDataUrl('https://example.com/a.png')).toBeNull();
  });
});

/**
 * 원격 주소로 저장하는 경로(AI 엽서)는 data URL이 없어 주소에서 확장자를 정해야 한다.
 * 확장자가 없으면 기기가 임시 파일을 이미지로 알아보지 못한다.
 */
describe('imageExtensionFromUrl', () => {
  it('경로 끝의 확장자를 읽는다', () => {
    expect(imageExtensionFromUrl('https://cdn.example.com/a/b/postcard.png')).toBe('png');
    expect(imageExtensionFromUrl('https://cdn.example.com/postcard.webp')).toBe('webp');
  });

  it('jpeg는 파일 확장자 jpg로 바꾼다 — parseImageDataUrl과 같은 규칙이다', () => {
    expect(imageExtensionFromUrl('https://cdn.example.com/postcard.jpeg')).toBe('jpg');
  });

  it('쿼리스트링·해시의 점을 확장자로 오인하지 않는다', () => {
    expect(imageExtensionFromUrl('https://cdn.example.com/postcard.png?v=1.2&t=abc')).toBe('png');
    expect(imageExtensionFromUrl('https://cdn.example.com/postcard?v=1.2')).toBe('jpg');
  });

  it('확장자가 없거나 모르는 확장자면 jpg로 둔다 — 서버가 만드는 엽서가 JPEG다', () => {
    expect(imageExtensionFromUrl('https://cdn.example.com/images/abc123')).toBe('jpg');
    expect(imageExtensionFromUrl('https://cdn.example.com/postcard.bin')).toBe('jpg');
  });
});
