/**
 * 앱 WebView가 심어준 익명 세션 토큰.
 *
 * web은 앱 WebView 안에서 "앱과 같은 사용자"로 API를 호출해야 한다. 토큰은 앱이
 * 발급·보관하고, 문서가 실행되기 전에 전역으로 심어준다
 * (app/src/components/HomeWebView/authTokenScript.ts).
 *
 * 브라우저에서 직접 열면 이 전역이 없다. 그때는 토큰 없이 나가고 서버가 401로 답한다 —
 * web이 스스로 /auth/anonymous를 부르면 앱과 다른 사용자가 만들어지므로 그러지 않는다.
 */

/** app의 WEB_AUTH_GLOBAL과 같은 이름이어야 한다 */
const AUTH_GLOBAL = '__TAMNALOG_AUTH__';

/** app의 WEB_APP_INFO_GLOBAL과 같은 이름이어야 한다 */
const APP_INFO_GLOBAL = '__TAMNALOG_APP__';

export interface WebViewAuth {
  accessToken: string;
  tokenType: string;
}

/**
 * WebView를 띄운 앱이 자기 신원을 심어 둔 값.
 */
export interface WebViewAppInfo {
  version: string;
  /** 앱이 토큰을 발급한 API origin. web의 API 주소와 같아야 한다 */
  apiOrigin: string;
}

type AuthCarrier = Window & {
  [AUTH_GLOBAL]?: WebViewAuth | null;
  [APP_INFO_GLOBAL]?: WebViewAppInfo | null;
};

/** 심어진 값이 우리가 기대하는 모양인지 확인한다 — 전역은 누구나 건드릴 수 있다 */
function isWebViewAuth(value: unknown): value is WebViewAuth {
  if (typeof value !== 'object' || value === null) return false;
  const { accessToken, tokenType } = value as Partial<WebViewAuth>;
  return typeof accessToken === 'string' && accessToken.length > 0 && typeof tokenType === 'string' && tokenType.length > 0;
}

export function readWebViewAuth(): WebViewAuth | null {
  // SSR에는 window가 없다. Next.js 서버 렌더 중 호출돼도 죽지 않아야 한다.
  if (typeof window === 'undefined') return null;

  const value = (window as AuthCarrier)[AUTH_GLOBAL];
  return isWebViewAuth(value) ? value : null;
}

/** 심어진 앱 정보가 우리가 기대하는 모양인지 확인한다 — 전역은 누구나 건드릴 수 있다 */
function isWebViewAppInfo(value: unknown): value is WebViewAppInfo {
  if (typeof value !== 'object' || value === null) return false;
  const { version, apiOrigin } = value as Partial<WebViewAppInfo>;
  return typeof version === 'string' && typeof apiOrigin === 'string';
}

/**
 * 앱이 심어 둔 신원. **null이면 이 전역을 모르는 낡은 앱이다.**
 *
 * `readWebViewAuth()`가 null인 것과 구별해야 한다 — 그쪽은 "토큰이 아직/이미 없다"는
 * 일시적인 상태이고 재발급으로 복구되지만, 이쪽이 null이면 복구할 상대가 없다.
 */
export function readWebViewAppInfo(): WebViewAppInfo | null {
  if (typeof window === 'undefined') return null;

  const value = (window as AuthCarrier)[APP_INFO_GLOBAL];
  return isWebViewAppInfo(value) ? value : null;
}

/** `${tokenType} ${accessToken}` — 서버가 준 tokenType을 그대로 쓴다(app 인터셉터와 같은 규칙) */
export function webViewAuthHeader(auth: WebViewAuth | null): string | null {
  if (!auth) return null;
  return `${auth.tokenType} ${auth.accessToken}`;
}
