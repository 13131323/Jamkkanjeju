import type { RefObject } from 'react';
import type WebView from 'react-native-webview';
import { reissueSession } from '@/services/auth';
import { buildAuthTokenScript } from './authTokenScript';
import { currentWebViewAppInfo } from './webViewAppInfo';
/** 앱이 재발급을 담당하고 WebView에는 액세스 토큰과 성공·실패 결과만 전달한다. */
export async function reissueWebViewAuth(webViewRef: RefObject<WebView | null>, failedAccessToken?: string): Promise<void> {
  try {
    const session = await reissueSession(failedAccessToken);
    const auth = session ? { accessToken: session.accessToken, tokenType: session.tokenType, loginUser: session.loginUser, expiresAt: session.expiresAt } : null;
    webViewRef.current?.injectJavaScript(buildAuthTokenScript(auth, currentWebViewAppInfo()) + resultScript({ ok: !!session, status: session ? 200 : 401 }));
  } catch (error) {
    const failure = error as { response?: { status?: number; data?: { code?: string; message?: string } } };
    webViewRef.current?.injectJavaScript(
      resultScript({ ok: false, status: failure.response?.status ?? 0, code: failure.response?.data?.code, message: failure.response?.data?.message ?? '인증 정보를 갱신하지 못했습니다.' }),
    );
  }
}
function resultScript(detail: { ok: boolean; status: number; code?: string; message?: string }): string {
  return `window.dispatchEvent(new CustomEvent('tamnalog:auth-refresh-result', {detail:${JSON.stringify(detail)}})); true;`;
}
