import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ current: null as any, requestAuthReissue: vi.fn(), clearLoginSession: vi.fn(), notifyApiError: vi.fn() }));
vi.mock('@sentry/nextjs', () => ({ withScope: vi.fn() }));
vi.mock('@packages/shared', () => ({ notifyApiError: m.notifyApiError }));
vi.mock('../auth/session', () => ({ isLogoutInProgress: () => false, readLoginSession: () => m.current, clearLoginSession: m.clearLoginSession }));
vi.mock('../auth/reissueToken', () => ({ requestAuthReissue: m.requestAuthReissue }));
const session = { accessToken: 'old', tokenType: 'Bearer', expiresAt: 0, loginUser: { id: 4, role: 'ADMIN' } };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8080');
  vi.stubEnv('NEXT_PUBLIC_KAKAO_MAP_KEY', 'test-key');
  vi.stubGlobal('window', {});
  m.current = { ...session };
  m.clearLoginSession.mockImplementation(() => {
    m.current = null;
  });
});
describe('웹 API 자동 재시도', () => {
  it('만료 토스트 없이 재발급하고 새 헤더로 한 번 재시도한다', async () => {
    const api = (await import('./instance')).default;
    const sent: string[] = [];
    api.defaults.adapter = async (config) => {
      sent.push(String(config.headers.Authorization));
      if (sent.length === 1) throw { isAxiosError: true, config, response: { status: 401, data: { code: 'EXPIRED_TOKEN', message: '만료된 토큰입니다.' } } };
      return { data: 'ok', status: 200, statusText: 'OK', headers: {}, config };
    };
    m.requestAuthReissue.mockImplementation(async () => {
      m.current = { ...session, accessToken: 'new' };
      return true;
    });
    expect((await api.get('/api/v2/users/me/home')).data).toBe('ok');
    expect(sent).toEqual(['Bearer old', 'Bearer new']);
    expect(m.requestAuthReissue).toHaveBeenCalledOnce();
    expect(m.notifyApiError).not.toHaveBeenCalled();
  });
  it('새 토큰도 만료 응답이면 반복하지 않고 로그인 상태를 정리한다', async () => {
    const api = (await import('./instance')).default;
    const adapter = vi.fn(async (config) => {
      throw { isAxiosError: true, config, response: { status: 401, data: { code: 'EXPIRED_TOKEN' } } };
    });
    api.defaults.adapter = adapter;
    m.requestAuthReissue.mockImplementation(async () => {
      m.current = { ...session, accessToken: 'new' };
      return true;
    });
    await expect(api.get('/api/v2/users/me/home')).rejects.toBeDefined();
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(m.requestAuthReissue).toHaveBeenCalledOnce();
    expect(m.clearLoginSession).toHaveBeenCalledOnce();
    expect(m.notifyApiError).toHaveBeenCalledOnce();
  });
  it('재발급 통신 오류에는 세션을 지우지 않는다', async () => {
    const api = (await import('./instance')).default;
    api.defaults.adapter = async (config) => {
      throw { config, response: { status: 401, data: { code: 'EXPIRED_TOKEN' } } };
    };
    m.requestAuthReissue.mockRejectedValue({ response: { status: 503, data: { message: '일시 오류' } } });
    await expect(api.get('/api/v2/users/me/home')).rejects.toMatchObject({ response: { status: 503 } });
    expect(m.clearLoginSession).not.toHaveBeenCalled();
  });
});
