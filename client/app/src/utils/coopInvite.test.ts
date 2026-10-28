import { describe, expect, it } from 'vitest';
import { readInviteToken, resolveCoopInviteEntry } from './coopInvite';

describe('readInviteToken', () => {
  it('문자열 토큰을 그대로 읽는다', () => {
    expect(readInviteToken('abc123')).toBe('abc123');
  });

  it('앞뒤 공백을 지운다 — 메신저가 링크를 감싸며 공백을 흘리는 경우가 있다', () => {
    expect(readInviteToken('  abc123 ')).toBe('abc123');
  });

  it('같은 키가 두 번 실리면 첫 값을 쓴다', () => {
    expect(readInviteToken(['first', 'second'])).toBe('first');
  });

  it('없거나 비었으면 null이다 — 그대로 보내면 서버가 400으로 돌려줄 뿐이다', () => {
    expect(readInviteToken(undefined)).toBeNull();
    expect(readInviteToken('')).toBeNull();
    expect(readInviteToken('   ')).toBeNull();
    expect(readInviteToken([])).toBeNull();
  });
});

describe('resolveCoopInviteEntry', () => {
  it('온보딩을 마쳤고 토큰이 있으면 참여 요청을 보낸다', () => {
    expect(resolveCoopInviteEntry('abc123', true)).toEqual({ kind: 'join', token: 'abc123' });
  });

  it('온보딩을 마치지 않았으면 토큰이 있어도 온보딩이 먼저다 — 참여자를 식별할 사용자가 없다', () => {
    expect(resolveCoopInviteEntry('abc123', false)).toEqual({ kind: 'onboarding' });
  });

  it('토큰이 없으면 invalid다', () => {
    expect(resolveCoopInviteEntry(null, true)).toEqual({ kind: 'invalid' });
  });
});
