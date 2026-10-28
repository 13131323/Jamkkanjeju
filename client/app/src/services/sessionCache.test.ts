import { beforeEach, describe, expect, it } from 'vitest';
import {
  authorizationHeaderOf,
  getCachedSession,
  setCachedSession,
  updateCachedUser,
} from './sessionCache';

const USER = {
  id: 8,
  arCharacter: { id: 5, name: '협재 파도지기', imageUrl: 'https://example.com/a.png' },
  userTravelStyle: null,
};

describe('sessionCache', () => {
  beforeEach(() => {
    setCachedSession(null);
  });

  it('비어 있으면 null이다', () => {
    expect(getCachedSession()).toBeNull();
  });

  it('저장한 세션을 그대로 돌려준다', () => {
    setCachedSession({ accessToken: 'token', tokenType: 'Bearer', user: null, apiOrigin: 'http://localhost:8000' });

    expect(getCachedSession()).toEqual({ accessToken: 'token', tokenType: 'Bearer', user: null, apiOrigin: 'http://localhost:8000' });
  });

  it('updateCachedUser는 토큰을 건드리지 않고 user만 바꾼다', () => {
    setCachedSession({ accessToken: 'token', tokenType: 'Bearer', user: null, apiOrigin: 'http://localhost:8000' });

    updateCachedUser(USER);

    expect(getCachedSession()).toEqual({ accessToken: 'token', tokenType: 'Bearer', user: USER, apiOrigin: 'http://localhost:8000' });
  });

  it('세션이 없으면 updateCachedUser는 아무 일도 하지 않는다', () => {
    updateCachedUser(USER);

    expect(getCachedSession()).toBeNull();
  });
});

describe('authorizationHeaderOf', () => {
  it('세션이 없으면 null이다', () => {
    expect(authorizationHeaderOf(null)).toBeNull();
  });

  it('서버가 준 tokenType을 그대로 쓴다', () => {
    expect(authorizationHeaderOf({ accessToken: 'abc', tokenType: 'Bearer', user: null, apiOrigin: 'http://localhost:8000' })).toBe(
      'Bearer abc',
    );
    expect(authorizationHeaderOf({ accessToken: 'abc', tokenType: 'bearer', user: null, apiOrigin: 'http://localhost:8000' })).toBe(
      'bearer abc',
    );
  });
});
