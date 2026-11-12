import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ readSession: vi.fn(), clearSession: vi.fn(), saveLoginSession: vi.fn() }));
const secure = vi.hoisted(() => ({ readRefreshCredential: vi.fn(), saveRefreshCredential: vi.fn(), clearRefreshCredential: vi.fn() }));
vi.mock('@/db/session', () => db);
vi.mock('./refreshTokenStorage', () => secure);
import { logoutSession, bootstrapSession, completeLogin, reissueSession, clearAuthSession, hydratableSession } from './auth';
import { getCachedSession, setCachedSession } from './sessionCache';
const user = { id: 4, nickname: '관리자', role: 'ADMIN' as const, onboardingCompleted: true };
const old = { accessToken: 'old', tokenType: 'Bearer', expiresAt: Date.now() + 1000000, loginUser: user, user: null, apiOrigin: 'http://localhost:8080' };
const response = { accessToken: 'new', refreshToken: 'private-refresh', tokenType: 'Bearer', accessTokenExpiresIn: 1800, refreshTokenExpiresIn: 1209600, user };
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  setCachedSession(null);
  process.env.EXPO_PUBLIC_API_URL = old.apiOrigin;
  db.readSession.mockResolvedValue(null);
  secure.readRefreshCredential.mockResolvedValue({ refreshToken: 'old-refresh', expiresAt: Date.now() + 1000000, apiOrigin: old.apiOrigin, userId: 4 });
});
describe('앱 리프레시 토큰 연결', () => {
  it('로그인 시 리프레시 토큰은 보안 저장소에만 저장한다', async () => {
    await completeLogin(response);
    expect(secure.saveRefreshCredential.mock.calls[0][0].refreshToken).toBe('private-refresh');
    expect(db.saveLoginSession.mock.calls[0][0]).not.toHaveProperty('refreshToken');
    expect(getCachedSession()).not.toHaveProperty('refreshToken');
  });
  it('동시 재발급은 한 번의 호출과 토큰 교체를 공유한다', async () => {
    setCachedSession(old);
    let resolve!: (value: unknown) => void;
    const post = vi.spyOn(axios, 'post').mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const a = reissueSession('old');
    const b = reissueSession('old');
    await Promise.resolve();
    resolve({ data: response });
    expect((await a)?.accessToken).toBe('new');
    expect((await b)?.accessToken).toBe('new');
    expect(post).toHaveBeenCalledOnce();
    expect(secure.saveRefreshCredential).toHaveBeenCalledOnce();
  });
  it('리프레시 토큰 인증 실패 시 두 저장소를 비운다', async () => {
    setCachedSession(old);
    vi.spyOn(axios, 'post').mockRejectedValue({ response: { status: 401 } });
    await expect(reissueSession()).rejects.toBeDefined();
    expect(getCachedSession()).toBeNull();
    expect(secure.clearRefreshCredential).toHaveBeenCalled();
    expect(db.clearSession).toHaveBeenCalled();
  });
  it('일시적인 서버 오류는 토큰을 유지한다', async () => {
    setCachedSession(old);
    vi.spyOn(axios, 'post').mockRejectedValue({ response: { status: 503 } });
    await expect(reissueSession()).rejects.toBeDefined();
    expect(getCachedSession()?.accessToken).toBe('old');
    expect(secure.clearRefreshCredential).not.toHaveBeenCalled();
  });
  it('새 토큰이 이미 있으면 늦게 도착한 옛 요청을 위해 다시 회전하지 않는다', async () => {
    setCachedSession({ ...old, accessToken: 'new' });
    const post = vi.spyOn(axios, 'post');
    expect((await reissueSession('old'))?.accessToken).toBe('new');
    expect(post).not.toHaveBeenCalled();
  });
  it('다른 서버·사용자의 보안 토큰은 사용하지 않는다', async () => {
    setCachedSession(old);
    secure.readRefreshCredential.mockResolvedValue({ refreshToken: 'foreign', expiresAt: Date.now() + 10000, apiOrigin: 'https://other.test', userId: 9 });
    const post = vi.spyOn(axios, 'post');
    expect(await reissueSession()).toBeNull();
    expect(post).not.toHaveBeenCalled();
    expect(getCachedSession()).toBeNull();
  });
  it('앱 시작 시 만료된 액세스 토큰은 로그인 이동보다 재발급을 먼저 한다', async () => {
    db.readSession.mockResolvedValue({ ...old, expiresAt: 0 });
    vi.spyOn(axios, 'post').mockResolvedValue({ data: response });
    expect((await bootstrapSession()).status).toBe('ready');
    expect(getCachedSession()?.accessToken).toBe('new');
  });
  it('기존 세션이 없으면 익명 계정을 발급하지 않는다', async () => {
    expect(await bootstrapSession()).toEqual({ status: 'ready', hasOnboardingResult: false });
    expect(getCachedSession()).toBeNull();
  });
  it('저장된 만료 토큰은 복원하되 다른 서버의 세션은 제외한다', () => {
    expect(hydratableSession({ ...old, expiresAt: 0 }, old.apiOrigin)).not.toBeNull();
    expect(hydratableSession(old, 'https://other.test')).toBeNull();
  });
  it('로그아웃 뒤 도착한 재발급 결과가 세션을 되살리지 않는다', async () => {
    setCachedSession(old);
    let resolve!: (v: unknown) => void;
    vi.spyOn(axios, 'post').mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const pending = reissueSession();
    await Promise.resolve();
    await clearAuthSession();
    resolve({ data: response });
    expect(await pending).toBeNull();
    expect(getCachedSession()).toBeNull();
    expect(secure.saveRefreshCredential).not.toHaveBeenCalled();
  });
});

describe('앱 서버 로그아웃', () => {
  it('최신 보안 토큰을 서버에 전달하고 두 저장소를 정리한다', async () => {
    setCachedSession(old);
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ status: 204 });
    await logoutSession();
    expect(post).toHaveBeenCalledWith(`${old.apiOrigin}/api/v2/auth/logout`, { refreshToken: 'old-refresh' }, { timeout: 15000 });
    expect(getCachedSession()).toBeNull();
    expect(secure.clearRefreshCredential).toHaveBeenCalledOnce();
    expect(db.clearSession).toHaveBeenCalledOnce();
  });
  it('서버 실패에도 로컬 토큰을 제거하고 실패는 호출자에게 전달한다', async () => {
    setCachedSession(old);
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('offline'));
    await expect(logoutSession()).rejects.toThrow('offline');
    expect(getCachedSession()).toBeNull();
    expect(secure.clearRefreshCredential).toHaveBeenCalledOnce();
    expect(db.clearSession).toHaveBeenCalledOnce();
  });
  it('보관된 리프레시 토큰이 없으면 서버 호출 없이 정리한다', async () => {
    setCachedSession(old);
    secure.readRefreshCredential.mockResolvedValue(null);
    const post = vi.spyOn(axios, 'post');
    await logoutSession();
    expect(post).not.toHaveBeenCalled();
    expect(getCachedSession()).toBeNull();
  });
  it('진행 중인 회전이 끝난 최신 토큰으로 로그아웃하고 추가 회전을 차단한다', async () => {
    setCachedSession(old);
    let resolve!: (value: unknown) => void;
    const post = vi
      .spyOn(axios, 'post')
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue({ status: 204 });
    secure.saveRefreshCredential.mockImplementation(async (value) => {
      secure.readRefreshCredential.mockResolvedValue(value);
    });
    const refresh = reissueSession();
    await Promise.resolve();
    const logout = logoutSession();
    expect(await reissueSession()).toBeNull();
    resolve({ data: response });
    await refresh;
    await logout;
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][1]).toEqual({ refreshToken: 'private-refresh' });
    expect(getCachedSession()).toBeNull();
  });
});
