import type { RefObject } from 'react';
import type WebView from 'react-native-webview';
import { reissueSession } from '@/services/auth';
import { buildAuthTokenScript } from './authTokenScript';
import { currentWebViewAppInfo } from './webViewAppInfo';

/**
 * `AUTH_TOKEN_REQUEST`에 대한 응답 — 새 토큰을 발급해 페이지에 다시 심는다.
 *
 * `sendToWeb`이 아니라 **주입 스크립트**를 쓴다. 브릿지 메시지는 web의 React 트리에 도착하지만
 * 토큰이 필요한 곳은 axios 인터셉터(트리 밖)다. 주입 스크립트는 이미 그 자리에 값을 심고
 * `tamnalog:auth-ready`까지 쏘므로 같은 경로를 그대로 다시 쓴다.
 *
 * 실패하면 아무것도 보내지 않는다 — web이 타임아웃으로 포기하고 원래 401을 그대로 노출한다.
 * 어느 화면에서든 401은 날 수 있어 훅이 아닌 함수로 둔다(호출부가 listenFromWeb 콜백 안이다).
 */
export async function reissueWebViewAuth(webViewRef: RefObject<WebView | null>): Promise<void> {
  const session = await reissueSession();
  if (!session) return;

  // 앱 정보도 함께 다시 심는다. 값은 실행 중에 바뀌지 않지만, 이 경로만 앱 정보를 빼면
  // 재주입 뒤 web이 "토큰은 있는데 앱 정보가 없다"를 보고 낡은 앱으로 오판한다.
  webViewRef.current?.injectJavaScript(buildAuthTokenScript({ accessToken: session.accessToken, tokenType: session.tokenType }, currentWebViewAppInfo()));
}
