import { AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ reissueSession: vi.fn(), clearAuthSession: vi.fn(), isLogoutInProgress: vi.fn(() => false) }));
vi.mock('./auth', () => auth);
import api from './client';
import { getCachedSession, setCachedSession } from './sessionCache';
import { clearMaintenance, getMaintenanceScreen } from '@packages/shared';
const user = { id: 4, role: 'ADMIN' as const, nickname: null, onboardingCompleted: true };
const session = { accessToken: 'old', tokenType: 'Bearer', expiresAt: Date.now() + 1000000, loginUser: user, user: null, apiOrigin: 'http://localhost' };
const handlers = api.interceptors as unknown as { request: { handlers: { fulfilled: (c: any) => any }[] }; response: { handlers: { rejected: (e: any) => Promise<unknown> }[] } };
function config() {
  return handlers.request.handlers[0].fulfilled({ url: '/api/v2/users/me/home', headers: new AxiosHeaders() });
}
beforeEach(() => {
  clearMaintenance();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  setCachedSession(session);
  auth.clearAuthSession.mockImplementation(async () => setCachedSession(null));
});
describe('앱 API 만료 재시도', () => {
  it('503이면 공통 점검 상태를 만들고 일반 요청을 차단하되 홈은 허용한다', async () => {
    const failure = { response: { status: 503, data: { code: 'POSTCARD_DISABLED' } } };
    await expect(handlers.response.handlers[0].rejected(failure)).rejects.toBe(failure);
    expect(getMaintenanceScreen()).toBe('notice');
    expect(() => handlers.request.handlers[0].fulfilled({ url: '/api/v2/map/contents', headers: new AxiosHeaders() })).toThrow('서비스 점검 중입니다.');
    expect(() => config()).not.toThrow();
    expect(auth.reissueSession).not.toHaveBeenCalled();
  });
  it('로그인 토큰을 요청에 넣는다', () => {
    expect(config().headers.get('Authorization')).toBe('Bearer old');
  });
  it('EXPIRED_TOKEN이면 갱신 후 원래 요청을 한 번 다시 보낸다', async () => {
    const c = config();
    auth.reissueSession.mockImplementation(async () => {
      const next = { ...session, accessToken: 'new' };
      setCachedSession(next);
      return next;
    });
    const request = vi.spyOn(api, 'request').mockResolvedValue({ data: 'ok' });
    await expect(handlers.response.handlers[0].rejected({ response: { status: 401, data: { code: 'EXPIRED_TOKEN' } }, config: c })).resolves.toEqual({ data: 'ok' });
    expect(auth.reissueSession).toHaveBeenCalledWith('old');
    expect(request.mock.calls[0][0]).toMatchObject({ authRetried: true });
  });
  it('재시도한 요청이 다시 만료되어도 반복 재발급하지 않는다', async () => {
    const c = { ...config(), authRetried: true };
    await expect(handlers.response.handlers[0].rejected({ response: { status: 401, data: { code: 'EXPIRED_TOKEN' } }, config: c })).rejects.toBeDefined();
    expect(auth.reissueSession).not.toHaveBeenCalled();
    expect(auth.clearAuthSession).toHaveBeenCalledOnce();
  });
  it('일반 403은 세션을 지우지 않는다', async () => {
    await expect(handlers.response.handlers[0].rejected({ response: { status: 403 }, config: config() })).rejects.toBeDefined();
    expect(auth.clearAuthSession).not.toHaveBeenCalled();
  });
  it('이전 계정의 늦은 401로 새 계정을 지우지 않는다', async () => {
    const c = config();
    setCachedSession({ ...session, accessToken: 'other', loginUser: { ...user, id: 9 } });
    await expect(handlers.response.handlers[0].rejected({ response: { status: 401, data: { code: 'EXPIRED_TOKEN' } }, config: c })).rejects.toBeDefined();
    expect(auth.reissueSession).not.toHaveBeenCalled();
    expect(getCachedSession()?.loginUser?.id).toBe(9);
  });
});
