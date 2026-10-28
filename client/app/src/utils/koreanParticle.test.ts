import { describe, expect, it } from 'vitest';
import { hasFinalConsonant, joinWithParticle } from './koreanParticle';

describe('hasFinalConsonant', () => {
  it('받침이 있는 글자로 끝나면 참', () => {
    expect(hasFinalConsonant('물범')).toBe(true);
    expect(hasFinalConsonant('바람 정령')).toBe(true);
  });

  it('받침이 없는 글자로 끝나면 거짓', () => {
    expect(hasFinalConsonant('로컬 탐험가')).toBe(false);
    expect(hasFinalConsonant('보물이')).toBe(false);
  });

  it('한글이 아니면 판단하지 않는다', () => {
    // 영문·숫자는 발음으로 갈려서 규칙을 세울 수 없다("AR"은 "알"로 읽어 받침이 있다)
    expect(hasFinalConsonant('AR')).toBeNull();
    expect(hasFinalConsonant('3')).toBeNull();
    expect(hasFinalConsonant('')).toBeNull();
  });

  it('뒤에 붙은 공백은 무시한다', () => {
    expect(hasFinalConsonant('물범 ')).toBe(true);
  });
});

describe('joinWithParticle', () => {
  it('받침에 따라 와/과를 고른다', () => {
    // 실제로 "로컬 탐험가과 함께"로 떠서 고친 자리다
    expect(joinWithParticle('로컬 탐험가', '과', '와')).toBe('로컬 탐험가와');
    expect(joinWithParticle('점박이 물범', '과', '와')).toBe('점박이 물범과');
  });

  it('판단할 수 없으면 받침이 있는 쪽을 쓴다', () => {
    // "AR와"보다 "AR과"가 덜 어색하다
    expect(joinWithParticle('AR', '과', '와')).toBe('AR과');
  });

  it('다른 조사 쌍에도 쓸 수 있다', () => {
    expect(joinWithParticle('물범', '은', '는')).toBe('물범은');
    expect(joinWithParticle('탐험가', '은', '는')).toBe('탐험가는');
  });
});
