import { describe, expect, it } from 'vitest';
import { resolveAppCompatibility } from './useAppCompatibility';

const APP_INFO = { version: '1.1.0', apiOrigin: 'https://api.example.com' };

/**
 * web은 원격 배포라 앱 버전과 무관하게 모든 기기에 최신 번들이 내려간다. 그래서 낡은 앱에서는
 * 모든 API가 401이 되고 복구 경로(AUTH_TOKEN_REQUEST)도 그 앱의 zod union에 없어 버려진다.
 * 그 상태를 web이 혼자 알아채야 한다 — docs/trouble/2026-09-09-webview-token-version-skew.md
 */
describe('resolveAppCompatibility', () => {
  it('WebView 밖(일반 브라우저)은 앱 정보가 없어도 정상이다', () => {
    expect(resolveAppCompatibility(false, null, 'https://api.example.com')).toBe('ok');
  });

  it('앱 정보를 심지 않은 WebView는 낡은 앱이다 — v1.0.0이 그렇다', () => {
    expect(resolveAppCompatibility(true, null, 'https://api.example.com')).toBe('app-outdated');
  });

  it('앱과 web의 API origin이 같으면 정상이다', () => {
    expect(resolveAppCompatibility(true, APP_INFO, 'https://api.example.com')).toBe('ok');
  });

  it('앱과 web의 API origin이 다르면 재발급으로도 복구되지 않는다', () => {
    expect(resolveAppCompatibility(true, APP_INFO, 'https://other.example.com')).toBe('api-origin-mismatch');
  });

  it('앱이 origin을 비워 보냈으면 대조하지 않는다 — 멀쩡한 조합을 막는 쪽이 더 나쁘다', () => {
    expect(resolveAppCompatibility(true, { version: '1.1.0', apiOrigin: '' }, 'https://api.example.com')).toBe('ok');
  });

  it('web이 자기 origin을 읽지 못했으면 대조하지 않는다', () => {
    expect(resolveAppCompatibility(true, APP_INFO, '')).toBe('ok');
  });

  it('낡은 앱 판정이 origin 대조보다 먼저다 — 토큰을 못 심는 앱에 주소 안내를 하면 어긋난다', () => {
    expect(resolveAppCompatibility(true, null, '')).toBe('app-outdated');
  });
});
