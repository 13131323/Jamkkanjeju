import { isAppWebView, sendToApp } from '@shared/lib/bridge/utils';
import { withBrowserAuthLock } from './browserAuth';
import { prepareLogout } from './reissueToken';
import { clearLoginSession } from './session';
import { isServiceUnavailable, notifyApiError } from '@packages/shared';

/** 웹은 HttpOnly 쿠키, 앱은 네이티브 보안 저장소의 최신 토큰으로 로그아웃한다. */
export async function requestLogout(): Promise<void> {
  await prepareLogout();
  if (isAppWebView()) {
    sendToApp({ type: 'AUTH_LOGOUT_REQUEST', payload: {} });
    return;
  }
  try {
    await withBrowserAuthLock(async () => {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        const error = { response: { status: response.status, data: await response.json().catch(() => null) } };
        if (isServiceUnavailable(error)) notifyApiError(error);
        throw error;
      }
    });
  } finally {
    clearLoginSession();
  }
}
