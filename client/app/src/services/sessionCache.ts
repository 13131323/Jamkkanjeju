/**
 * 세션 메모리 캐시.
 *
 * axios 요청 인터셉터는 동기 함수라 sqlite를 기다릴 수 없다. 부트스트랩이
 * 앱 시작 시 여기에 세션을 올려두고, 인터셉터와 화면은 이 값을 동기로 읽는다.
 *
 * client.ts가 auth.ts를 직접 import하면 auth.ts → 생성 API → client.ts로
 * 순환이 생긴다. 그래서 캐시만 따로 떼어 두 쪽이 이 모듈에만 의존하게 했다.
 */
import type { GeneratedApi } from '@packages/shared';
import type { StoredSession } from '@/db/models/Session';

let cached: StoredSession | null = null;

export function getCachedSession(): StoredSession | null {
  return cached;
}

export function setCachedSession(session: StoredSession | null): void {
  cached = session;
}

/** 온보딩 응답을 받은 직후 호출한다. 토큰은 그대로 두고 user만 갱신한다 */
export function updateCachedUser(user: GeneratedApi.UserResponse): void {
  if (!cached) return;
  cached = { ...cached, user };
}

/** tokenType은 서버 응답값을 그대로 쓴다 — 값이 바뀌어도 따라간다 */
export function authorizationHeaderOf(session: StoredSession | null): string | null {
  if (!session) return null;
  return `${session.tokenType} ${session.accessToken}`;
}
