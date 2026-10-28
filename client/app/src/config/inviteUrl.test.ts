import { describe, expect, it } from 'vitest';
import { buildInviteAppLink, buildInviteUrl, COOP_INVITE_APP_PATH, COOP_INVITE_PATH } from './inviteUrl';

describe('buildInviteUrl', () => {
  it('builds an invite URL from an explicit web URL and a team token', () => {
    expect(buildInviteUrl('abc123', 'https://tamnalog.app', false)).toBe('https://tamnalog.app/cooperative-missions/invite?token=abc123');
  });

  it('uses the shared invite path constant', () => {
    expect(buildInviteUrl('abc123', 'https://tamnalog.app', false)).toContain(COOP_INVITE_PATH);
  });

  it('dedupes a trailing slash on the base URL', () => {
    // 공유된 링크에 `//`가 남으면 배포 환경에 따라 404가 난다
    expect(buildInviteUrl('abc123', 'https://tamnalog.app/', false)).toBe('https://tamnalog.app/cooperative-missions/invite?token=abc123');
  });

  it('falls back to the configured dev URL when development has no explicit URL', () => {
    expect(buildInviteUrl('abc123', undefined, true, 'http://10.0.2.2:3000')).toBe('http://10.0.2.2:3000/cooperative-missions/invite?token=abc123');
  });

  it('percent-encodes a token containing URL-significant characters', () => {
    // 서버 토큰 규칙이 바뀌어 base64 같은 값이 와도 링크가 잘리면 안 된다
    expect(buildInviteUrl('a+b/c d', 'https://tamnalog.app', false)).toBe('https://tamnalog.app/cooperative-missions/invite?token=a%2Bb%2Fc%20d');
  });

  it('rejects an empty token', () => {
    // 어디로도 들어가지 못하는 링크를 공유하느니 공유 시점에 실패하는 편이 낫다
    expect(() => buildInviteUrl('', 'https://tamnalog.app', false)).toThrow();
  });

  it('rejects a blank token', () => {
    expect(() => buildInviteUrl('   ', 'https://tamnalog.app', false)).toThrow();
  });

  it('rejects a missing URL outside development', () => {
    // 도메인 해석 실패는 resolveWebViewUrl의 에러를 그대로 통과시킨다
    expect(() => buildInviteUrl('abc123', undefined, false)).toThrow('EXPO_PUBLIC_WEB_URL');
  });

  it('rejects a missing URL in development when no dev fallback is configured', () => {
    expect(() => buildInviteUrl('abc123', undefined, true)).toThrow('EXPO_PUBLIC_DEV_WEB_URL');
  });
});

describe('buildInviteAppLink', () => {
  it('builds the app-scheme link the web landing page redirects to', () => {
    expect(buildInviteAppLink('abc123')).toBe('tamnalog:///mission/invite?token=abc123');
  });

  it('leaves the host empty so the path stays intact', () => {
    // `tamnalog://mission/invite`는 `mission`이 호스트로 읽혀 경로가 `/invite`만 남는 파서가 있다
    expect(buildInviteAppLink('abc123')).toContain('://' + COOP_INVITE_APP_PATH);
  });

  it('percent-encodes a token containing URL-significant characters', () => {
    expect(buildInviteAppLink('a+b/c d')).toBe('tamnalog:///mission/invite?token=a%2Bb%2Fc%20d');
  });

  it('rejects an empty or blank token', () => {
    expect(() => buildInviteAppLink('')).toThrow();
    expect(() => buildInviteAppLink('   ')).toThrow();
  });
});
