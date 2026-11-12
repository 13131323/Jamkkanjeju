import axios from 'axios';
import { isLoginSession, isStoredLoginSession, loginSessionFrom, type LoginResponse } from '@packages/shared';
import type { StoredSession } from '@/db/models/Session';
import { clearSession, readSession, saveLoginSession } from '@/db/session';
import { authorizationHeaderOf, getCachedSession, getSessionRevision, setCachedSession } from './sessionCache';
import { clearRefreshCredential, readRefreshCredential, saveRefreshCredential } from './refreshTokenStorage';
export type BootstrapStatus = 'ready' | 'offline' | 'server-error';
export interface BootstrapResult {
  status: BootstrapStatus;
  hasOnboardingResult: boolean;
}
export function apiOriginOf(rawUrl: string | undefined): string {
  if (!rawUrl) return '';
  try {
    return new URL(rawUrl).origin;
  } catch {
    return rawUrl;
  }
}
/** 만료된 액세스 토큰도 재발급을 위해 복원한다. */
export function hydratableSession(stored: StoredSession | null, currentOrigin: string): StoredSession | null {
  return isStoredLoginSession(stored) && stored.apiOrigin === currentOrigin ? stored : null;
}
let storageWork: Promise<unknown> = Promise.resolve();
function serializeStorage<T>(work: () => Promise<T>): Promise<T> {
  const result = storageWork.then(work, work);
  storageWork = result.catch(() => undefined);
  return result;
}
/** 로그아웃과 재발급 저장을 직렬화해 이전 계정이 되살아나지 않도록 한다. */
export async function clearAuthSession(expectedRevision?: number): Promise<void> {
  if (expectedRevision !== undefined && expectedRevision !== getSessionRevision()) return;
  setCachedSession(null);
  await serializeStorage(async () => {
    try {
      await clearRefreshCredential();
    } finally {
      await clearSession();
    }
  });
}
async function storeResponse(response: LoginResponse, origin: string, revision: number, user: StoredSession['user']): Promise<StoredSession | null> {
  return serializeStorage(async () => {
    if (revision !== getSessionRevision()) return getCachedSession();
    const session = loginSessionFrom(response);
    await saveRefreshCredential({ refreshToken: response.refreshToken, expiresAt: Date.now() + response.refreshTokenExpiresIn * 1000, apiOrigin: origin, userId: response.user.id });
    await saveLoginSession(session, origin, user);
    if (revision !== getSessionRevision()) return getCachedSession();
    const next = { ...session, apiOrigin: origin, user };
    setCachedSession(next);
    return next;
  });
}
/** 로그인 응답의 리프레시 토큰은 SecureStore에, 공개 세션 정보는 SQLite에 저장한다. */
export async function completeLogin(response: LoginResponse): Promise<StoredSession | null> {
  return storeResponse(response, apiOriginOf(process.env.EXPO_PUBLIC_API_URL), getSessionRevision(), null);
}
export async function hydrateSessionCache(): Promise<boolean> {
  const origin = apiOriginOf(process.env.EXPO_PUBLIC_API_URL);
  if (hydratableSession(getCachedSession(), origin)) return true;
  const session = hydratableSession(await readSession(), origin);
  setCachedSession(session);
  return session !== null;
}
export function hasUsableAuthorization(): boolean {
  return authorizationHeaderOf(getCachedSession()) !== null;
}
let pendingRefresh: { revision: number; promise: Promise<StoredSession | null> } | null = null;
let pendingLogout: Promise<void> | null = null;
export function isLogoutInProgress(): boolean {
  return pendingLogout !== null;
}
/** 진행 중인 회전이 끝난 뒤 최신 토큰만 서버에서 삭제하고 로컬 인증 정보는 항상 정리한다. */
export function logoutSession(): Promise<void> {
  if (pendingLogout) return pendingLogout;
  const promise = (async () => {
    await pendingRefresh?.promise.catch(() => undefined);
    try {
      await serializeStorage(async () => {
        const credential = await readRefreshCredential();
        const current = getCachedSession();
        if (credential && credential.apiOrigin === apiOriginOf(process.env.EXPO_PUBLIC_API_URL) && credential.userId === current?.loginUser?.id) {
          await axios.post(`${process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '')}/api/v2/auth/logout`, { refreshToken: credential.refreshToken }, { timeout: 15000 });
        }
      });
    } finally {
      await clearAuthSession();
    }
  })();
  pendingLogout = promise;
  void promise
    .finally(() => {
      if (pendingLogout === promise) pendingLogout = null;
    })
    .catch(() => undefined);
  return promise;
}
/** 앱 API·여러 WebView의 동시 재발급 요청이 하나의 토큰 회전 결과를 공유한다. */
export function reissueSession(failedAccessToken?: string): Promise<StoredSession | null> {
  if (isLogoutInProgress()) return Promise.resolve(null);
  const current = getCachedSession();
  if (!current) return Promise.resolve(null);
  if (failedAccessToken && current.accessToken !== failedAccessToken && isLoginSession(current)) return Promise.resolve(current);
  const revision = getSessionRevision();
  if (pendingRefresh?.revision === revision) return pendingRefresh.promise;
  const promise = (async () => {
    const credential = await readRefreshCredential();
    if (revision !== getSessionRevision()) return getCachedSession();
    if (!credential || credential.apiOrigin !== current.apiOrigin || credential.userId !== current.loginUser?.id || credential.expiresAt <= Date.now()) {
      await clearAuthSession(revision);
      return null;
    }
    try {
      // 일반 API 인터셉터를 거치지 않아 재발급 요청 자체의 재시도를 막는다.
      const { data } = await axios.post<LoginResponse>(`${process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '')}/api/v2/auth/refresh`, { refreshToken: credential.refreshToken }, { timeout: 15000 });
      if (data.user.id !== current.loginUser?.id) {
        await clearAuthSession(revision);
        return null;
      }
      return await storeResponse(data, credential.apiOrigin, revision, current.user);
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 401 || status === 403) await clearAuthSession(revision);
      // 일시적인 통신·서버 오류에서는 토큰을 유지해 재시도할 수 있게 한다.
      throw error;
    }
  })();
  pendingRefresh = { revision, promise };
  void promise
    .finally(() => {
      if (pendingRefresh?.promise === promise) pendingRefresh = null;
    })
    .catch(() => undefined);
  return promise;
}
export async function bootstrapSession(): Promise<BootstrapResult> {
  try {
    const restored = await hydrateSessionCache();
    if (restored && !isLoginSession(getCachedSession())) await reissueSession();
    const session = getCachedSession();
    return { status: 'ready', hasOnboardingResult: session?.loginUser?.onboardingCompleted === true || session?.user != null };
  } catch (error) {
    const response = (error as { response?: { status?: number } }).response;
    if (response?.status === 401 || response?.status === 403) return { status: 'ready', hasOnboardingResult: false };
    return { status: response ? 'server-error' : 'offline', hasOnboardingResult: false };
  }
}
