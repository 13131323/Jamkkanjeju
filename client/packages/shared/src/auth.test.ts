import { describe, expect, it } from 'vitest';
import { offsetAdminCoords, SEOUL_CITY_HALL, JEJU_CITY_HALL, isLoginSession, loginSessionFrom } from './auth';
describe('관리자 GPS와 로그인 세션', () => {
  it('일반 사용자와 미로그인은 원본을 그대로 사용한다', () => {
    const p = { ...SEOUL_CITY_HALL, accuracy: 10 };
    expect(offsetAdminCoords(p, 'USER')).toBe(p);
    expect(offsetAdminCoords(p)).toBe(p);
  });
  it('서울시청을 제주시청으로 옮긴다', () => {
    const p = offsetAdminCoords(SEOUL_CITY_HALL, 'ADMIN');
    expect(p.lat).toBeCloseTo(JEJU_CITY_HALL.lat);
    expect(p.lng).toBeCloseTo(JEJU_CITY_HALL.lng);
  });
  it('이동량과 GPS 메타데이터를 보존한다', () => {
    const p = offsetAdminCoords({ lat: SEOUL_CITY_HALL.lat + 0.01, lng: SEOUL_CITY_HALL.lng - 0.01, accuracy: 5 }, 'ADMIN');
    expect(p.lat).toBeCloseTo(JEJU_CITY_HALL.lat + 0.01);
    expect(p.lng).toBeCloseTo(JEJU_CITY_HALL.lng - 0.01);
    expect(p.accuracy).toBe(5);
  });
  it('기존 익명 토큰과 만료된 세션은 복원하지 않는다', () => {
    expect(isLoginSession({ accessToken: 'old', tokenType: 'Bearer' })).toBe(false);
    expect(isLoginSession({ accessToken: 'old', tokenType: 'Bearer', expiresAt: 0, loginUser: { id: 1, role: 'ADMIN' } })).toBe(false);
  });
  it('로그인 응답의 권한과 만료 시간을 세션에 유지한다', () => {
    const s = loginSessionFrom({
      accessToken: 'jwt',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      accessTokenExpiresIn: 1000,
      refreshTokenExpiresIn: 2000,
      user: { id: 4, nickname: '관리자', role: 'ADMIN', onboardingCompleted: true },
    });
    expect(isLoginSession(s)).toBe(true);
    expect(s.loginUser.role).toBe('ADMIN');
    expect(s).not.toHaveProperty('refreshToken');
  });
});
