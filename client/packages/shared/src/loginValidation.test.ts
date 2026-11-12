import { describe, expect, it } from 'vitest';
import { limitLoginInput, validateLoginInput } from './loginValidation';

describe('로그인 입력 제약', () => {
  it.each(['admin', ' ADMIN ', 'user@example.com', ' USER@EXAMPLE.COM '])('허용된 아이디: %s', (identifier) => {
    expect(validateLoginInput(identifier, '12345678')).toBeNull();
  });

  it.each(['admin23123', 'user', 'user@example', 'user @example.com', 'user@@example.com'])('이메일 형식 오류: %s', (identifier) => {
    expect(validateLoginInput(identifier, '12345678')).toBe('아이디는 이메일 형식입니다');
  });

  it('아이디와 비밀번호가 모두 잘못되면 아이디만 안내한다', () => {
    expect(validateLoginInput('invalid', '123')).toBe('아이디는 이메일 형식입니다');
  });

  it('7자 비밀번호를 차단하고 8자부터 64자까지 허용한다', () => {
    expect(validateLoginInput('admin', '1234567')).toBe('비밀번호는 8자리 이상이어야합니다');
    expect(validateLoginInput('admin', '12345678')).toBeNull();
    expect(validateLoginInput('admin', 'a'.repeat(64))).toBeNull();
    expect(validateLoginInput('admin', 'a'.repeat(65))).toBe('비밀번호는 64자까지 입력가능합니다');
  });

  it('255자 이메일은 허용하고 256자는 차단한다', () => {
    expect(validateLoginInput(`${'a'.repeat(249)}@b.com`, '12345678')).toBeNull();
    expect(validateLoginInput(`${'a'.repeat(250)}@b.com`, '12345678')).toBe('이메일은 255자까지 입력가능합니다');
  });

  it.each([
    ['identifier', 255, '이메일은'],
    ['password', 64, '비밀번호는'],
  ] as const)('%s 입력과 붙여넣기를 최대 길이로 제한한다', (field, maxLength, label) => {
    const atLimit = 'a'.repeat(maxLength);
    expect(limitLoginInput(field, atLimit)).toEqual({ value: atLimit, error: '' });
    expect(limitLoginInput(field, `${atLimit}extra pasted text`)).toEqual({ value: atLimit, error: `${label} ${maxLength}자까지 입력가능합니다` });
    expect(limitLoginInput(field, 'short')).toEqual({ value: 'short', error: '' });
  });
});
