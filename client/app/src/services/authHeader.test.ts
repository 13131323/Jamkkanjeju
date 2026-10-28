import { JUDGE_ACCESS_TOKEN } from '@packages/shared';
import { describe, expect, it } from 'vitest';
import { readSentAuthorizationHeader, resolveAuthorizationHeader, shouldDiscardSessionOnUnauthorized } from './authHeader';

const APP_HEADER = 'Bearer app-anonymous-token';
const JUDGE_HEADER = `Bearer ${JUDGE_ACCESS_TOKEN}`;

describe('resolveAuthorizationHeader', () => {
  it('모드가 꺼져 있으면 앱 토큰을 그대로 쓴다', () => {
    expect(resolveAuthorizationHeader(false, APP_HEADER)).toBe(APP_HEADER);
  });

  it('토큰이 없으면 null — /auth/anonymous는 토큰 없이 나가는 것이 정상이다', () => {
    expect(resolveAuthorizationHeader(false, null)).toBeNull();
  });

  // 이 규칙이 web(shared/api/axios/instance.ts)과 같아야 홈에서 본 진행도를 앱이 이어받는다
  it('심사위원용 모드가 켜지면 심사위원 토큰이 앱 토큰보다 우선이다', () => {
    expect(resolveAuthorizationHeader(true, APP_HEADER)).toBe(JUDGE_HEADER);
  });

  it('앱 토큰이 없어도 모드가 켜져 있으면 심사위원 토큰으로 부른다', () => {
    expect(resolveAuthorizationHeader(true, null)).toBe(JUDGE_HEADER);
  });

  it('모드를 끄면 곧바로 앱 토큰으로 돌아온다', () => {
    expect(resolveAuthorizationHeader(true, APP_HEADER)).toBe(JUDGE_HEADER);
    expect(resolveAuthorizationHeader(false, APP_HEADER)).toBe(APP_HEADER);
  });
});

describe('shouldDiscardSessionOnUnauthorized', () => {
  it('앱 토큰이 거절당했으면 버린다', () => {
    expect(shouldDiscardSessionOnUnauthorized(APP_HEADER, APP_HEADER)).toBe(true);
  });

  // 심사위원 토큰의 401은 "서버에 목업 사용자가 없다"는 뜻이다. 앱 신원을 지울 이유가 없다
  it('심사위원 토큰이 거절당해도 앱 세션은 지킨다', () => {
    expect(shouldDiscardSessionOnUnauthorized(JUDGE_HEADER, APP_HEADER)).toBe(false);
  });

  // 헤드리스 백그라운드 실행은 부트스트랩이 없어 토큰 없이 나간다(gpsBackgroundTask.ts)
  it('토큰 없이 나간 요청의 401로는 저장된 세션을 지우지 않는다', () => {
    expect(shouldDiscardSessionOnUnauthorized(null, APP_HEADER)).toBe(false);
    expect(shouldDiscardSessionOnUnauthorized(undefined, APP_HEADER)).toBe(false);
  });

  it('이미 세션이 없으면 지울 것도 없다', () => {
    expect(shouldDiscardSessionOnUnauthorized(APP_HEADER, null)).toBe(false);
  });

  // 재발급 직후 도착한 옛 요청의 401이 새 토큰을 지우면 안 된다
  it('응답을 기다리는 사이 세션이 교체됐으면 지우지 않는다', () => {
    expect(shouldDiscardSessionOnUnauthorized(APP_HEADER, 'Bearer reissued-token')).toBe(false);
  });
});

describe('readSentAuthorizationHeader', () => {
  it('요청 인터셉터가 적어 둔 표시를 먼저 본다 — axios의 헤더 정규화를 타지 않는다', () => {
    expect(readSentAuthorizationHeader({ config: { sentAuthHeader: APP_HEADER, headers: { authorization: 'Bearer stale' } } })).toBe(APP_HEADER);
  });

  it('표시가 null이면 토큰 없이 나간 요청이다', () => {
    expect(readSentAuthorizationHeader({ config: { sentAuthHeader: null, headers: {} } })).toBeNull();
  });

  it('config.headers의 Authorization을 읽는다', () => {
    expect(readSentAuthorizationHeader({ config: { headers: { Authorization: APP_HEADER } } })).toBe(APP_HEADER);
  });

  it('소문자 키도 읽는다', () => {
    expect(readSentAuthorizationHeader({ config: { headers: { authorization: APP_HEADER } } })).toBe(APP_HEADER);
  });

  it('어떤 모양이 와도 던지지 않고 null을 돌려준다', () => {
    expect(readSentAuthorizationHeader(undefined)).toBeNull();
    expect(readSentAuthorizationHeader(null)).toBeNull();
    expect(readSentAuthorizationHeader('boom')).toBeNull();
    expect(readSentAuthorizationHeader({})).toBeNull();
    expect(readSentAuthorizationHeader({ config: {} })).toBeNull();
    expect(readSentAuthorizationHeader({ config: { headers: {} } })).toBeNull();
    expect(readSentAuthorizationHeader({ config: { headers: { Authorization: '' } } })).toBeNull();
    expect(readSentAuthorizationHeader({ config: { headers: { Authorization: 123 } } })).toBeNull();
  });
});
