import type { GeneratedApi } from '@packages/shared';

/** Session 테이블의 한 행. 익명 사용자는 기기당 하나라 id는 항상 1이다. */
export interface SessionRow {
  id: 1;
  accessToken: string;
  tokenType: string;
  /** PATCH /users/me 응답의 user를 직렬화한 값. 온보딩 전에는 null */
  userJson: string | null;
  /** 이 토큰을 발급한 API 주소(origin). 이 컬럼이 생기기 전에 저장된 행은 null */
  apiOrigin: string | null;
  updatedAt: number;
}

/** 서비스·화면이 다루는 형태 */
export interface StoredSession {
  accessToken: string;
  /** 서버가 준 값을 그대로 쓴다(현재 "Bearer") */
  tokenType: string;
  /** 온보딩 응답을 아직 못 받았으면 null */
  user: GeneratedApi.UserResponse | null;
  /**
   * 이 토큰을 발급한 API 주소(origin).
   *
   * 토큰은 발급한 서버에서만 유효하다. 개발 중 EXPO_PUBLIC_API_URL을 바꾸면 저장된 토큰이
   * 죽는데, 이 값이 없으면 앱이 그걸 알 방법이 없어 401을 계속 맞는다.
   * 이 컬럼이 생기기 전에 저장된 세션은 null이다.
   */
  apiOrigin: string | null;
}
