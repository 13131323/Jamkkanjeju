import * as Sentry from '@sentry/nextjs';
import { isAppWebView, sendToApp } from '@shared/lib/bridge/utils';

/**
 * 401을 만났을 때 앱에 토큰을 다시 심어 달라고 요청하고, 심긴 것을 확인해 준다.
 *
 * web은 토큰을 발급할 수 없다 — 스스로 `/auth/anonymous`를 부르면 앱과 **다른 사용자**가 된다
 * (api/auth/webViewToken.ts). 그래서 401은 화면이 비는 것으로 끝났고(마이페이지에서 확인),
 * 앱에 부탁하는 것이 유일한 복구 경로다. 앱이 주입 스크립트로 심으면 아래 이벤트가 온다.
 */

/**
 * 앱의 주입 스크립트가 토큰을 심은 뒤 쏘는 이벤트.
 * **app/src/components/HomeWebView/authTokenScript.ts의 `WEB_AUTH_READY_EVENT`와 같아야 한다.**
 */
const AUTH_READY_EVENT = 'tamnalog:auth-ready';

/**
 * 앱의 응답을 이만큼 기다린다(ms).
 *
 * 앱이 그 사이 POST /auth/anonymous를 왕복해야 하므로 넉넉해야 하고, 길면 401을 맞은 화면이
 * 그만큼 빈 채로 멈춘다. 타임아웃은 "복구 못 했다"로 끝나 원래 401이 호출부로 전달된다.
 */
const AUTH_REISSUE_TIMEOUT_MS = 5000;

/**
 * 진행 중인 재발급 요청.
 *
 * 401은 여러 요청에서 동시에 터진다(마이페이지는 진입 시 요약·도감·미션을 함께 부른다).
 * 그때마다 부탁하면 익명 사용자가 그만큼 만들어지고 마지막 것만 살아남아 앞선 재시도가 다시
 * 401이 된다 — **한 번만 보내고 모두가 같은 약속을 기다린다.**
 */
let pendingReissue: Promise<boolean> | null = null;

/**
 * 앱에 토큰 재발급을 요청하고 심길 때까지 기다린다.
 *
 * @returns 새 토큰이 심겼으면 true. WebView 밖이거나 시간 안에 오지 않으면 false.
 */
export function requestAuthReissue(): Promise<boolean> {
  // WebView 밖(일반 브라우저)에서는 부탁할 앱이 없다. 여기서 끊지 않으면 모든 401이
  // 타임아웃만큼 지연된 뒤 실패한다.
  if (!isAppWebView()) return Promise.resolve(false);

  if (pendingReissue) return pendingReissue;

  pendingReissue = new Promise<boolean>((resolve) => {
    // 두 함수는 아래 timer보다 먼저 선언되지만 호출은 그 뒤에만 일어난다(함수 선언이라 호이스팅된다)
    function settle(didReissue: boolean) {
      clearTimeout(timer);
      window.removeEventListener(AUTH_READY_EVENT, onAuthReady);
      // 다음 401이 다시 요청할 수 있도록 자리를 비운다 — 같은 약속을 계속 재사용하면
      // 새 토큰으로도 거절당한 401을 조용히 성공으로 처리하게 된다
      pendingReissue = null;
      resolve(didReissue);
    }

    function onAuthReady() {
      settle(true);
    }

    // 리스너를 **보내기 전에** 건다. 앱의 injectJavaScript가 먼저 도착하면 신호를 놓친다.
    window.addEventListener(AUTH_READY_EVENT, onAuthReady);
    const timer = setTimeout(() => {
      // 침묵하면 안 된다. 이 경로가 실패하면 화면은 그냥 비고(홈 배너·마이페이지), 원인이
      // 401인지 서버가 빈 응답을 준 것인지 구별할 단서가 아무것도 남지 않는다.
      // 앱이 낡아 AUTH_TOKEN_REQUEST를 모르면 조용히 버리므로 여기가 유일한 관측 지점이다.
      Sentry.captureMessage('auth reissue timeout — 앱이 응답하지 않았다', 'warning');
      settle(false);
    }, AUTH_REISSUE_TIMEOUT_MS);

    sendToApp({ type: 'AUTH_TOKEN_REQUEST', payload: {} });
  });

  return pendingReissue;
}
