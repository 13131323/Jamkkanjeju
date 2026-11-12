import { getCachedSession } from '@/services/sessionCache';
import { buildAuthTokenScript } from './authTokenScript';
import { currentWebViewAppInfo } from './webViewAppInfo';
/** 웹의 첫 요청 전 앱과 같은 로그인 사용자·토큰을 주입한다. */
export function buildWebViewBootstrapScript(): string {
  const session = getCachedSession();
  return buildAuthTokenScript(session ? { accessToken: session.accessToken, tokenType: session.tokenType, loginUser: session.loginUser, expiresAt: session.expiresAt } : null, currentWebViewAppInfo());
}
