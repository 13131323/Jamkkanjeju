import { describe, expect, it } from 'vitest';
import { toAddressUnit } from './addressUnit';

describe('toAddressUnit', () => {
  it('지번 주소는 동까지만 남긴다', () => {
    expect(toAddressUnit('제주특별자치도 제주시 이도이동 1234-5')).toBe('제주특별자치도 제주시 이도이동');
  });

  it('도로명 주소는 동이 없으므로 시까지만 남긴다', () => {
    expect(toAddressUnit('제주특별자치도 제주시 문연로 6')).toBe('제주특별자치도 제주시');
  });

  it('읍·면도 남기는 단위다', () => {
    expect(toAddressUnit('제주특별자치도 제주시 조천읍 신촌리 123')).toBe('제주특별자치도 제주시 조천읍');
    expect(toAddressUnit('제주특별자치도 서귀포시 안덕면 사계리 1')).toBe('제주특별자치도 서귀포시 안덕면');
  });

  it('리는 남기지 않는다 — 읍/면 뒤에 한 단계 더 붙어 다시 길어진다', () => {
    expect(toAddressUnit('제주특별자치도 제주시 한경면 용수리 2517')).not.toContain('용수리');
  });

  it('구가 있는 주소는 구까지 남긴다', () => {
    expect(toAddressUnit('서울특별시 강남구 테헤란로 152')).toBe('서울특별시 강남구');
  });

  it('시와 동이 함께 있으면 더 좁은 단위(동)까지 남긴다 — 앞에서 찾으면 동이 사라진다', () => {
    expect(toAddressUnit('서울특별시 종로구 사직동 1')).toBe('서울특별시 종로구 사직동');
  });

  it('이미 단위로 끝나는 주소는 그대로 둔다', () => {
    expect(toAddressUnit('제주특별자치도 제주시 이도이동')).toBe('제주특별자치도 제주시 이도이동');
  });

  it('연속 공백을 정리한다', () => {
    expect(toAddressUnit('  제주특별자치도   제주시  이도이동 1234 ')).toBe('제주특별자치도 제주시 이도이동');
  });

  it('접미사를 못 찾으면 원본을 그대로 준다 — 주소를 통째로 잃지 않는다', () => {
    expect(toAddressUnit('Somewhere Far Away')).toBe('Somewhere Far Away');
  });

  it('빈 문자열은 그대로 준다', () => {
    expect(toAddressUnit('')).toBe('');
    expect(toAddressUnit('   ')).toBe('   ');
  });
});
