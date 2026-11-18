import { loginSessionFrom, isServiceUnavailable, notifyApiError, type WebLoginResponse } from '@packages/shared';
import { saveLoginSession } from './session';
/** 브라우저 탭 사이에서도 쿠키 회전을 직렬화한다. 지원하지 않는 환경은 탭 내부 중복 방지를 사용한다. */
export async function withBrowserAuthLock<T>(work: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) return await navigator.locks.request('tamnalog:auth', work);
  return work();
}
export async function authRequest(path: 'login' | 'refresh', body: unknown): Promise<WebLoginResponse> {
  const response = await fetch(`/api/auth/${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = { response: { status: response.status, data } };
    if (isServiceUnavailable(error)) notifyApiError(error);
    throw error;
  }
  return data;
}
export async function browserLogin(email: string, password: string): Promise<void> {
  await withBrowserAuthLock(async () => {
    const data = await authRequest('login', { email, password, deviceInfo: 'Web' });
    saveLoginSession(loginSessionFrom(data));
  });
}
