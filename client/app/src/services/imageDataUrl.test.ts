import { describe, expect, it } from 'vitest';
import { parseImageDataUrl } from './imageDataUrl';

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
