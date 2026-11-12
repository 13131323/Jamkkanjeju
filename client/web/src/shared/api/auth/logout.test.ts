import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ isAppWebView: vi.fn(), sendToApp: vi.fn(), prepareLogout: vi.fn(), clearLoginSession: vi.fn(), fetch: vi.fn() }));
vi.mock('@shared/lib/bridge/utils', () => m);
vi.mock('./reissueToken', () => m);
vi.mock('./session', () => m);
vi.mock('./browserAuth', () => ({ withBrowserAuthLock: (work: () => Promise<unknown>) => work() }));
import { requestLogout } from './logout';
beforeEach(() => {
  vi.clearAllMocks();
  m.isAppWebView.mockReturnValue(false);
  vi.stubGlobal('fetch', m.fetch);
});
afterEach(() => vi.unstubAllGlobals());
describe('설정 로그아웃 연결', () => {
  it('재발급 정리 후 중계 API를 호출하고 공개 세션을 삭제한다', async () => {
    m.fetch.mockResolvedValue(new Response(null, { status: 204 }));
    await requestLogout();
    expect(m.prepareLogout).toHaveBeenCalledOnce();
    expect(m.fetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST', credentials: 'same-origin', body: '{}' }));
    expect(m.clearLoginSession).toHaveBeenCalledOnce();
  });
  it('서버 오류에도 세션을 지우고 서버 메시지를 전달한다', async () => {
    m.fetch.mockResolvedValue(Response.json({ message: '서버 내부 오류가 발생했습니다.' }, { status: 500 }));
    await expect(requestLogout()).rejects.toMatchObject({ response: { status: 500, data: { message: '서버 내부 오류가 발생했습니다.' } } });
    expect(m.clearLoginSession).toHaveBeenCalledOnce();
  });
  it('앱에서는 쿠키 API 대신 네이티브 로그아웃을 요청한다', async () => {
    m.isAppWebView.mockReturnValue(true);
    await requestLogout();
    expect(m.sendToApp).toHaveBeenCalledWith({ type: 'AUTH_LOGOUT_REQUEST', payload: {} });
    expect(m.fetch).not.toHaveBeenCalled();
    expect(m.clearLoginSession).not.toHaveBeenCalled();
  });
});
