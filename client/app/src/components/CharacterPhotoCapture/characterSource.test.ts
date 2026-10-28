import { describe, expect, it } from 'vitest';
import type { PhotoCaptureCharacter } from './characterSource';
import { resolveCharacterSource } from './characterSource';

/** require()로 들어오는 로컬 에셋 자리. 숫자 모듈 id라 동등 비교로 확인할 수 있다 */
const FALLBACK = 42;

const CHARACTER: PhotoCaptureCharacter = { id: 1, name: '귤이', imageUrl: 'https://example.com/character.png' };

describe('resolveCharacterSource', () => {
  it('캐릭터를 받지 않은 화면에서는 로컬 에셋이 있어도 null이다', () => {
    // 협동 "재료 찾기" — 합성할 캐릭터가 없으므로 레이어 자체를 그리지 않는다
    expect(resolveCharacterSource({ character: undefined, fallbackImage: FALLBACK, hasRemoteFailed: false })).toBeNull();
  });

  it('서버 URL이 있고 아직 실패하지 않았으면 원격 이미지를 쓴다', () => {
    expect(resolveCharacterSource({ character: CHARACTER, fallbackImage: FALLBACK, hasRemoteFailed: false })).toEqual({ uri: CHARACTER.imageUrl });
  });

  it('원격 URL을 한 번 못 불러오면 로컬 에셋으로 되돌린다', () => {
    expect(resolveCharacterSource({ character: CHARACTER, fallbackImage: FALLBACK, hasRemoteFailed: true })).toBe(FALLBACK);
  });

  it('서버 URL이 null이면 로컬 에셋을 쓴다', () => {
    expect(resolveCharacterSource({ character: { ...CHARACTER, imageUrl: null }, fallbackImage: FALLBACK, hasRemoteFailed: false })).toBe(FALLBACK);
  });

  it('서버 URL이 빈 문자열이어도 로컬 에셋을 쓴다', () => {
    // <Image source={{ uri: '' }}>는 아무것도 그리지 않는다 — null과 같게 다뤄야 한다
    expect(resolveCharacterSource({ character: { ...CHARACTER, imageUrl: '' }, fallbackImage: FALLBACK, hasRemoteFailed: false })).toBe(FALLBACK);
  });

  it('그릴 것이 하나도 남지 않으면 null이다', () => {
    expect(resolveCharacterSource({ character: { ...CHARACTER, imageUrl: null }, fallbackImage: undefined, hasRemoteFailed: false })).toBeNull();
  });
});
