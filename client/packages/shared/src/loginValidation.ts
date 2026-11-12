export const LOGIN_IDENTIFIER_MAX_LENGTH = 255;
export const LOGIN_PASSWORD_MIN_LENGTH = 8;
export const LOGIN_PASSWORD_MAX_LENGTH = 64;

export type LoginField = 'identifier' | 'password';

export function limitLoginInput(field: LoginField, input: string) {
  const maxLength = field === 'identifier' ? LOGIN_IDENTIFIER_MAX_LENGTH : LOGIN_PASSWORD_MAX_LENGTH;
  return {
    value: input.slice(0, maxLength),
    error: input.length > maxLength ? `${field === 'identifier' ? '이메일은' : '비밀번호는'} ${maxLength}자까지 입력가능합니다` : '',
  };
}

/** 아이디 오류를 먼저 반환한다. 비밀번호는 공백 제거 등으로 변형하지 않는다. */
export function validateLoginInput(identifier: string, password: string): string | null {
  const email = identifier.trim().toLowerCase();
  if (email.length > LOGIN_IDENTIFIER_MAX_LENGTH) return limitLoginInput('identifier', email).error;
  if (!/^(?:admin|[^@\s]+@[^@\s]+\.[^@\s]+)$/.test(email)) return '아이디는 이메일 형식입니다';
  if (password.length < LOGIN_PASSWORD_MIN_LENGTH) return '비밀번호는 8자리 이상이어야합니다';
  if (password.length > LOGIN_PASSWORD_MAX_LENGTH) return limitLoginInput('password', password).error;
  return null;
}
