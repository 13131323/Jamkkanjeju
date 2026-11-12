import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { handleBrowserAuth } from './server';
const issued = {
  accessToken: 'access',
  refreshToken: 'secret-refresh',
  tokenType: 'Bearer',
  accessTokenExpiresIn: 1800,
  refreshTokenExpiresIn: 1209600,
  user: { id: 4, nickname: '관리자', role: 'ADMIN', onboardingCompleted: true },
};
const fetchMock = vi.fn();
function request(action = 'login', origin = 'https://app.test', cookie?: string) {
  return new NextRequest(`https://app.test/api/auth/${action}`, {
    method: 'POST',
    headers: { origin, host: 'app.test', 'content-type': 'application/json', ...(cookie ? { cookie: `tamnalog-refresh=${cookie}` } : {}) },
    body: JSON.stringify({ email: 'admin', password: '12345678' }),
  });
}
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://backend.test');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('브라우저 인증 중계', () => {
  it('로그인은 리프레시 토큰을 HttpOnly·Secure·SameSite 쿠키로만 반환한다', async () => {
    fetchMock.mockResolvedValue(Response.json(issued));
    const res = await handleBrowserAuth(request(), 'login');
    expect(res.status).toBe(200);
    expect(await res.json()).not.toHaveProperty('refreshToken');
    const cookie = res.headers.get('set-cookie');
    expect(cookie).toContain('secret-refresh');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toContain('Path=/api/auth');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
  it('재발급은 Body가 아닌 쿠키의 리프레시 토큰을 전달하고 교체한다', async () => {
    fetchMock.mockResolvedValue(Response.json(issued));
    const res = await handleBrowserAuth(request('refresh', 'https://app.test', 'old-refresh'), 'refresh');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refreshToken: 'old-refresh' });
    expect(res.headers.get('set-cookie')).toContain('secret-refresh');
    expect(await res.json()).not.toHaveProperty('refreshToken');
  });
  it.each([401, 403])('재발급 인증 실패 %i는 쿠키를 삭제한다', async (status) => {
    fetchMock.mockResolvedValue(Response.json({ code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다.' }, { status }));
    const res = await handleBrowserAuth(request('refresh', 'https://app.test', 'old'), 'refresh');
    expect(res.status).toBe(status);
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('일시적인 서버 오류에서는 쿠키를 삭제하지 않는다', async () => {
    fetchMock.mockResolvedValue(Response.json({ code: 'INTERNAL_SERVER_ERROR', message: '서버 내부 오류가 발생했습니다.' }, { status: 500 }));
    const res = await handleBrowserAuth(request('refresh', 'https://app.test', 'old'), 'refresh');
    expect(res.status).toBe(500);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
  it('다른 출처 요청은 백엔드 호출 전에 거부한다', async () => {
    expect((await handleBrowserAuth(request('refresh', 'https://evil.test', 'old'), 'refresh')).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('쿠키가 없으면 인증 오류를 반환한다', async () => {
    expect((await handleBrowserAuth(request('refresh'), 'refresh')).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('잘못된 로그인 JSON은 400이다', async () => {
    const req = new NextRequest('https://app.test/api/auth/login', { method: 'POST', headers: { origin: 'https://app.test', host: 'app.test', 'content-type': 'application/json' }, body: '{' });
    expect((await handleBrowserAuth(req, 'login')).status).toBe(400);
  });
  it('통신 오류에는 토큰이나 내부 오류를 노출하지 않는다', async () => {
    fetchMock.mockRejectedValue(new Error('private-connection-detail'));
    const res = await handleBrowserAuth(request('refresh', 'https://app.test', 'old'), 'refresh');
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('private-connection-detail');
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});
