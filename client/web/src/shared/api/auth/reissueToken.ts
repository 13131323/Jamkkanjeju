import { loginSessionFrom } from '@packages/shared';
import { isAppWebView, sendToApp } from '@shared/lib/bridge/utils';
import { authRequest, withBrowserAuthLock } from './browserAuth';
import { beginLogout, isLogoutInProgress, clearLoginSession, readLoginSession, saveLoginSession } from './session';
let pendingReissue: Promise<boolean> | null = null;
/** 진행 중인 회전이 끝난 최신 쿠키로 로그아웃하고 추가 회전은 차단한다. */
export async function prepareLogout(): Promise<void> {
  beginLogout();
  await pendingReissue?.catch(() => undefined);
}
function failure(status: number, code: string, message: string) {
  return { response: { status, data: { code, message } } };
}
/** 앱은 SecureStore, 일반 웹은 HttpOnly 쿠키로 재발급한다. 여러 만료 요청은 같은 결과를 기다린다. */
export function requestAuthReissue(failedAccessToken?: string): Promise<boolean> {
  if (isLogoutInProgress()) return Promise.resolve(false);
  const previous = readLoginSession();
  if (failedAccessToken && previous && previous.accessToken !== failedAccessToken && previous.expiresAt > Date.now()) return Promise.resolve(true);
  if (pendingReissue) return pendingReissue;
  const promise = isAppWebView()
    ? requestFromApp(failedAccessToken ?? previous?.accessToken)
    : withBrowserAuthLock(async () => {
        const current = readLoginSession();
        if (previous && current && (current.accessToken !== previous.accessToken || current.expiresAt !== previous.expiresAt) && current.expiresAt > Date.now()) return true;
        try {
          const data = await authRequest('refresh', {});
          if (isLogoutInProgress()) return false;
          const latest = readLoginSession();
          if (previous && latest && latest.loginUser.id !== previous.loginUser.id) return false;
          saveLoginSession(loginSessionFrom(data));
          return true;
        } catch (error) {
          const status = (error as { response?: { status?: number } }).response?.status;
          if ((status === 401 || status === 403) && readLoginSession()?.accessToken === previous?.accessToken) clearLoginSession();
          throw error;
        }
      });
  pendingReissue = promise;
  void promise
    .finally(() => {
      if (pendingReissue === promise) pendingReissue = null;
    })
    .catch(() => undefined);
  return promise;
}
function requestFromApp(accessToken?: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    function finish() {
      clearTimeout(timer);
      window.removeEventListener('tamnalog:auth-refresh-result', onResult);
    }
    function onResult(event: Event) {
      const detail = (event as CustomEvent<{ ok: boolean; status: number; code?: string; message?: string }>).detail;
      if (!detail) return;
      finish();
      if (detail.ok && readLoginSession()) resolve(true);
      else {
        if (detail.status === 401 || detail.status === 403) clearLoginSession();
        reject(failure(detail.status, detail.code ?? 'AUTH_REFRESH_FAILED', detail.message ?? '인증 정보를 갱신하지 못했습니다.'));
      }
    }
    window.addEventListener('tamnalog:auth-refresh-result', onResult);
    const timer = setTimeout(() => {
      finish();
      reject(failure(0, 'AUTH_REFRESH_TIMEOUT', '인증 정보 갱신이 지연되고 있습니다. 다시 시도해 주세요.'));
    }, 20000);
    sendToApp({ type: 'AUTH_TOKEN_REQUEST', payload: { accessToken } });
  });
}
