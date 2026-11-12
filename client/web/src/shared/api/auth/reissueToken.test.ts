import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  isLogoutInProgress: vi.fn(() => false),
  beginLogout: vi.fn(),
  isAppWebView: vi.fn(),
  sendToApp: vi.fn(),
  authRequest: vi.fn(),
  readLoginSession: vi.fn(),
  saveLoginSession: vi.fn(),
  clearLoginSession: vi.fn(),
}));
vi.mock('@shared/lib/bridge/utils', () => mocks);
vi.mock('./browserAuth', () => ({ authRequest: mocks.authRequest, withBrowserAuthLock: (work: () => Promise<unknown>) => work() }));
vi.mock('./session', () => mocks);
const old = { accessToken: 'old', tokenType: 'Bearer', expiresAt: 0, loginUser: { id: 4, role: 'ADMIN', nickname: null, onboardingCompleted: true } };
const issued = { accessToken: 'new', tokenType: 'Bearer', accessTokenExpiresIn: 1800, refreshTokenExpiresIn: 1209600, user: old.loginUser };
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.isAppWebView.mockReturnValue(false);
  mocks.isLogoutInProgress.mockReturnValue(false);
  mocks.beginLogout.mockImplementation(() => mocks.isLogoutInProgress.mockReturnValue(true));
  mocks.readLoginSession.mockReturnValue(old);
  vi.stubGlobal('window', new EventTarget());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('웹 자동 재발급', () => {
  it('동시 만료 요청은 브라우저 재발급 한 번을 공유한다', async () => {
    let finish!: (v: typeof issued) => void;
    mocks.authRequest.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { requestAuthReissue } = await import('./reissueToken');
    const all = [requestAuthReissue('old'), requestAuthReissue('old'), requestAuthReissue('old')];
    finish(issued);
    expect(await Promise.all(all)).toEqual([true, true, true]);
    expect(mocks.authRequest).toHaveBeenCalledTimes(1);
    expect(mocks.saveLoginSession.mock.calls[0][0]).not.toHaveProperty('refreshToken');
  });
  it('재발급 인증 실패 시 세션을 지운다', async () => {
    mocks.authRequest.mockRejectedValue({ response: { status: 401 } });
    const { requestAuthReissue } = await import('./reissueToken');
    await expect(requestAuthReissue()).rejects.toBeDefined();
    expect(mocks.clearLoginSession).toHaveBeenCalledOnce();
  });
  it('통신 실패 시 세션을 유지한다', async () => {
    mocks.authRequest.mockRejectedValue({ response: { status: 503 } });
    const { requestAuthReissue } = await import('./reissueToken');
    await expect(requestAuthReissue()).rejects.toBeDefined();
    expect(mocks.clearLoginSession).not.toHaveBeenCalled();
  });
  it('앱에서는 재발급 API를 직접 호출하지 않고 브리지 응답을 기다린다', async () => {
    mocks.isAppWebView.mockReturnValue(true);
    const { requestAuthReissue } = await import('./reissueToken');
    const pending = requestAuthReissue('old');
    expect(mocks.sendToApp).toHaveBeenCalledWith({ type: 'AUTH_TOKEN_REQUEST', payload: { accessToken: 'old' } });
    mocks.readLoginSession.mockReturnValue({ ...old, accessToken: 'new' });
    const event = new Event('tamnalog:auth-refresh-result');
    Object.defineProperty(event, 'detail', { value: { ok: true, status: 200 } });
    window.dispatchEvent(event);
    expect(await pending).toBe(true);
    expect(mocks.authRequest).not.toHaveBeenCalled();
  });
  it('앱 응답의 일시 오류도 로그인 상태를 유지한다', async () => {
    mocks.isAppWebView.mockReturnValue(true);
    const { requestAuthReissue } = await import('./reissueToken');
    const pending = requestAuthReissue();
    const expectation = expect(pending).rejects.toMatchObject({ response: { status: 503 } });
    const event = new Event('tamnalog:auth-refresh-result');
    Object.defineProperty(event, 'detail', { value: { ok: false, status: 503 } });
    window.dispatchEvent(event);
    await expectation;
    expect(mocks.clearLoginSession).not.toHaveBeenCalled();
  });
  it('앱이 응답하지 않으면 무한 대기하지 않는다', async () => {
    vi.useFakeTimers();
    mocks.isAppWebView.mockReturnValue(true);
    const { requestAuthReissue } = await import('./reissueToken');
    const promise = requestAuthReissue();
    const expectation = expect(promise).rejects.toMatchObject({ response: { data: { code: 'AUTH_REFRESH_TIMEOUT' } } });
    await vi.advanceTimersByTimeAsync(20000);
    await expectation;
  });
});

it('로그아웃 시작 시 진행 중인 회전을 기다리고 세션 복원과 추가 회전을 막는다', async () => {
  let finish!: (v: typeof issued) => void;
  mocks.authRequest.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { requestAuthReissue, prepareLogout } = await import('./reissueToken');
  const refresh = requestAuthReissue();
  const logout = prepareLogout();
  expect(await requestAuthReissue()).toBe(false);
  finish(issued);
  await logout;
  expect(await refresh).toBe(false);
  expect(mocks.saveLoginSession).not.toHaveBeenCalled();
  expect(mocks.authRequest).toHaveBeenCalledOnce();
});
