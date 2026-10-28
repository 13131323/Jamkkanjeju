/**
 * WebView 안의 web 페이지에 익명 세션 토큰과 앱 정보를 심는 스크립트를 만든다.
 *
 * web은 앱 WebView 안에서 "앱과 같은 사용자"로 API를 호출해야 한다. 토큰은 앱의
 * sqlite에만 있고 web은 접근할 수 없다. web이 스스로 /auth/anonymous를 부르면
 * 다른 사용자가 만들어지므로 앱이 넘겨주는 수밖에 없다.
 *
 * 브릿지 메시지가 아니라 주입을 쓰는 이유: 브릿지는 페이지 로드 뒤에야 오갈 수 있어
 * web의 첫 쿼리가 토큰보다 먼저 나가 401이 된다. injectedJavaScriptBeforeContentLoaded는
 * 문서가 실행되기 전에 돌아 그 경쟁 자체가 없다(safeAreaScript와 같은 이유).
 *
 * 마지막 `true;`는 injectJavaScript 때문이다. 주입한 스크립트의 마지막 평가값을
 * WebView가 네이티브로 직렬화해 보내는데, 값이 객체면 그 과정에서 경고가 뜬다.
 */

/** web이 읽는 전역 이름. web/src/shared/api/auth/webViewToken.ts와 같은 값이어야 한다 */
export const WEB_AUTH_GLOBAL = 'window.__TAMNALOG_AUTH__';

/**
 * 앱의 신원을 담는 전역. **web/src/shared/api/auth/webViewToken.ts와 같은 값이어야 한다.**
 *
 * 브릿지 메시지가 아니라 주입에 실은 이유가 여기 있다. 새 브릿지 type은 **앱이 검증하므로**
 * 낡은 앱이 조용히 버린다 — A를 만든 그 드리프트를 판정 수단으로 쓸 수는 없다. 주입 전역은
 * web이 혼자 읽으므로 앱이 낡았을 때 "값이 없다"가 그대로 관측된다.
 */
export const WEB_APP_INFO_GLOBAL = 'window.__TAMNALOG_APP__';

/** 토큰이 늦게 도착했을 때(재주입) web이 다시 읽도록 알리는 이벤트 이름 */
export const WEB_AUTH_READY_EVENT = 'tamnalog:auth-ready';

export interface WebViewAuth {
  accessToken: string;
  tokenType: string;
}

export interface WebViewAppInfo {
  /** app.json의 expo.version. 업데이트 안내에 그대로 노출한다 */
  version: string;
  apiOrigin: string;
}

export function buildAuthTokenScript(auth: WebViewAuth | null, appInfo: WebViewAppInfo): string {
  // JSON.stringify로 직렬화해야 토큰 안의 따옴표·백슬래시가 스크립트를 깨지 않는다.
  // 토큰은 서버가 만든 값이지만 문자열을 그대로 코드에 이어붙이는 습관은 두지 않는다.
  const payload = auth === null ? 'null' : JSON.stringify(auth);

  // 앱 정보를 토큰보다 **먼저** 심는다. tamnalog:auth-ready를 듣고 깨어나는 쪽이
  // 이미 앱 정보를 볼 수 있어야 "토큰은 왔는데 앱 정보는 아직"이라는 상태가 생기지 않는다.
  return `
    (function () {
      ${WEB_APP_INFO_GLOBAL} = ${JSON.stringify(appInfo)};
      ${WEB_AUTH_GLOBAL} = ${payload};
      window.dispatchEvent(new Event('${WEB_AUTH_READY_EVENT}'));
    })();
    true;
  `;
}
