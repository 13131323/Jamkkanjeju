import { describe, expect, it } from 'vitest';
import { resolveWebViewUrl } from './webUrl';

describe('resolveWebViewUrl', () => {
  it('uses an explicitly configured development URL', () => {
    expect(resolveWebViewUrl('http://127.0.0.1:3000', true)).toBe('http://127.0.0.1:3000');
  });

  it('falls back to the configured dev URL when development has no explicit URL', () => {
    expect(resolveWebViewUrl(undefined, true, undefined, 'http://10.0.2.2:3000')).toBe(
      'http://10.0.2.2:3000',
    );
  });

  it('rejects a missing URL in development when no dev fallback is configured', () => {
    // 코드에 기본 URL을 두지 않으므로 .env를 빼먹으면 흰 화면 대신 에러로 드러나야 한다
    expect(() => resolveWebViewUrl(undefined, true)).toThrow('EXPO_PUBLIC_DEV_WEB_URL');
  });

  it('rejects a missing URL outside development', () => {
    expect(() => resolveWebViewUrl(undefined, false)).toThrow('EXPO_PUBLIC_WEB_URL');
  });

  it('appends a path to an explicit URL', () => {
    expect(resolveWebViewUrl('http://127.0.0.1:3000', true, '/map?mode=treasure')).toBe(
      'http://127.0.0.1:3000/map?mode=treasure',
    );
  });

  it('appends a path to the configured dev fallback', () => {
    expect(resolveWebViewUrl(undefined, true, '/map?mode=treasure', 'http://10.0.2.2:3000')).toBe(
      'http://10.0.2.2:3000/map?mode=treasure',
    );
  });

  it('normalizes a missing leading slash on the path', () => {
    expect(resolveWebViewUrl('http://127.0.0.1:3000', true, 'map?mode=treasure')).toBe(
      'http://127.0.0.1:3000/map?mode=treasure',
    );
  });

  it('dedupes a trailing slash on the base URL against the path', () => {
    expect(resolveWebViewUrl('http://127.0.0.1:3000/', true, '/map?mode=treasure')).toBe(
      'http://127.0.0.1:3000/map?mode=treasure',
    );
  });

  it('still rejects a missing URL outside development even when a path is given', () => {
    expect(() => resolveWebViewUrl(undefined, false, '/map?mode=treasure')).toThrow('EXPO_PUBLIC_WEB_URL');
  });
});
