'use client';
import { isStoredLoginSession, type LoginSession } from '@packages/shared';
export const SESSION_EVENT = 'tamnalog:auth-ready';
const KEY = 'tamnalog:login-session';
let loggingOut = false;
export function isLogoutInProgress(): boolean {
  return loggingOut;
}
export function beginLogout(): void {
  loggingOut = true;
}
/** 앱 주입 세션을 우선하며, 일반 브라우저만 자신의 로그인 세션을 보관한다. */
export function readLoginSession(): LoginSession | null {
  if (typeof window === 'undefined') return null;
  const carrier = window as unknown as Record<string, unknown>;
  if ('__TAMNALOG_AUTH__' in carrier) {
    const session = carrier.__TAMNALOG_AUTH__;
    return isStoredLoginSession(session) ? session : null;
  }
  try {
    const session = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return isStoredLoginSession(session) ? session : null;
  } catch {
    return null;
  }
}
export function saveLoginSession(session: LoginSession): void {
  loggingOut = false;
  localStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SESSION_EVENT));
}
export function clearLoginSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
  const carrier = window as unknown as Record<string, unknown>;
  if ('__TAMNALOG_AUTH__' in carrier) carrier.__TAMNALOG_AUTH__ = null;
  window.dispatchEvent(new Event(SESSION_EVENT));
}
export function accountId(): string {
  return String(readLoginSession()?.loginUser.id ?? 'anonymous');
}
