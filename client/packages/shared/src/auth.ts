/** 로그인 응답과 GPS 변환 규칙. 웹과 앱이 같은 계정·좌표 기준을 사용한다. */
export interface LoginUser {
  id: number;
  nickname: string | null;
  role: 'USER' | 'ADMIN';
  onboardingCompleted: boolean;
}
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  user: LoginUser;
}
export interface LoginSession {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
  loginUser: LoginUser;
}
// 테스트 기준점. 제주 기준은 기존 장소 시드와 같은 제주시청 좌표를 유지한다.
export const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 } as const;
export const JEJU_CITY_HALL = { lat: 33.4996, lng: 126.5312 } as const;
export function offsetAdminCoords<T extends { lat: number; lng: number }>(coords: T, role?: string): T {
  if (role !== 'ADMIN') return coords;
  return { ...coords, lat: coords.lat + JEJU_CITY_HALL.lat - SEOUL_CITY_HALL.lat, lng: coords.lng + JEJU_CITY_HALL.lng - SEOUL_CITY_HALL.lng };
}
export function isStoredLoginSession(value: unknown): value is LoginSession {
  if (!value || typeof value !== 'object') return false;
  const s = value as LoginSession;
  return (
    typeof s.accessToken === 'string' &&
    s.accessToken.length > 0 &&
    s.tokenType === 'Bearer' &&
    Number.isFinite(s.expiresAt) &&
    Number.isSafeInteger(s.loginUser?.id) &&
    (s.loginUser?.role === 'ADMIN' || s.loginUser?.role === 'USER')
  );
}
export function isLoginSession(value: unknown): value is LoginSession {
  return isStoredLoginSession(value) && value.expiresAt > Date.now();
}
export type WebLoginResponse = Omit<LoginResponse, 'refreshToken'>;
export function loginSessionFrom(response: WebLoginResponse): LoginSession {
  return { accessToken: response.accessToken, tokenType: response.tokenType, expiresAt: Date.now() + response.accessTokenExpiresIn * 1000, loginUser: response.user };
}
