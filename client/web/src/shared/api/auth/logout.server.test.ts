import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { handleBrowserLogout } from './server';

const fetchMock = vi.fn();
function request(origin = 'https://app.test', cookie: string | null = 'latest-refresh') {
  return new NextRequest('https://app.test/api/auth/logout', {
    method: 'POST',
    headers: { origin, host: 'app.test', 'content-type': 'application/json', ...(cookie ? { cookie: `tamnalog-refresh=${cookie}` } : {}) },
    body: JSON.stringify({ refreshToken: 'untrusted-body' }),
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

describe('브라우저 로그아웃 중계', () => {
  it('HttpOnly 쿠키의 토큰만 전달하고 빈 204와 쿠키 삭제를 반환한다', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const result = await handleBrowserLogout(request());
    expect(fetchMock.mock.calls[0][0]).toBe('https://backend.test/api/v2/auth/logout');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refreshToken: 'latest-refresh' });
    expect(result.status).toBe(204);
    expect(await result.text()).toBe('');
    expect(result.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    expect(result.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(result.headers.get('set-cookie')).toContain('Path=/api/auth');
    expect(result.headers.get('cache-control')).toBe('no-store');
  });
  it('쿠키가 없으면 서버 호출 없이 204로 정리한다', async () => {
    const result = await handleBrowserLogout(request('https://app.test', null));
    expect(result.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('서버 오류 메시지를 유지하면서 쿠키는 삭제한다', async () => {
    fetchMock.mockResolvedValue(Response.json({ code: 'INTERNAL_SERVER_ERROR', message: '서버 내부 오류가 발생했습니다.' }, { status: 500 }));
    const result = await handleBrowserLogout(request());
    expect(result.status).toBe(500);
    expect(await result.json()).toEqual({ code: 'INTERNAL_SERVER_ERROR', message: '서버 내부 오류가 발생했습니다.' });
    expect(result.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('네트워크 실패에도 쿠키를 삭제하고 실패를 반환한다', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const result = await handleBrowserLogout(request());
    expect(result.status).toBe(503);
    expect(result.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('외부 출처의 로그아웃은 차단하고 쿠키를 변경하지 않는다', async () => {
    const result = await handleBrowserLogout(request('https://attacker.test'));
    expect(result.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.headers.get('set-cookie')).toBeNull();
  });
});
