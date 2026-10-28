import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readSession: vi.fn(),
  saveToken: vi.fn(),
  clearSession: vi.fn(),
  issueAnonymous: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@/db/session', () => ({
  readSession: mocks.readSession,
  saveToken: mocks.saveToken,
  clearSession: mocks.clearSession,
}));

// 실물을 불러오면 react-native/index.js(Flow)까지 끌려와 vitest가 파싱에 실패한다.
// 저장 실패를 기록하는지는 확인해야 하므로 함수만 갈아 끼운다.
vi.mock('@sentry/react-native', () => ({ captureException: mocks.captureException }));

/** vitest.config의 define과 별개로, 테스트마다 API 주소를 바꿔가며 확인한다 */
const CURRENT_API_URL = 'http://localhost:8000';
const CURRENT_ORIGIN = 'http://localhost:8000';

vi.mock('@/services/api/auth/auth', () => ({
  issueAnonymousUserApiV1AuthAnonymousPost: mocks.issueAnonymous,
}));

const USER = {
  id: 8,
  arCharacter: { id: 5, name: '협재 파도지기', imageUrl: 'https://example.com/a.png' },
  userTravelStyle: null,
};

describe('bootstrapSession', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.saveToken.mockResolvedValue(undefined);
    mocks.clearSession.mockResolvedValue(undefined);
    process.env.EXPO_PUBLIC_API_URL = CURRENT_API_URL;
    const { setCachedSession } = await import('./sessionCache');
    setCachedSession(null);
  });

  it('저장된 토큰이 있으면 네트워크를 타지 않는다', async () => {
    mocks.readSession.mockResolvedValue({ accessToken: 'saved', tokenType: 'Bearer', user: null, apiOrigin: CURRENT_ORIGIN });
    const { bootstrapSession } = await import('./auth');
    const { getCachedSession } = await import('./sessionCache');

    const result = await bootstrapSession();

    expect(mocks.issueAnonymous).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'ready', hasOnboardingResult: false });
    expect(getCachedSession()?.accessToken).toBe('saved');
  });

  it('저장된 user가 있으면 hasOnboardingResult가 true다', async () => {
    mocks.readSession.mockResolvedValue({ accessToken: 'saved', tokenType: 'Bearer', user: USER, apiOrigin: CURRENT_ORIGIN });
    const { bootstrapSession } = await import('./auth');

    await expect(bootstrapSession()).resolves.toEqual({
      status: 'ready',
      hasOnboardingResult: true,
    });
  });

  it('다른 서버가 발급한 토큰이면 버리고 새로 받는다', async () => {
    // EXPO_PUBLIC_API_URL을 바꿔 개발하다 보면 저장된 토큰이 죽는데,
    // 이걸 그대로 재사용하면 앱은 계속 401만 맞는다.
    mocks.readSession.mockResolvedValue({
      accessToken: 'azure-token',
      tokenType: 'Bearer',
      user: USER,
      apiOrigin: 'https://jankkan-jeju.azurewebsites.net',
    });
    mocks.issueAnonymous.mockResolvedValue({ accessToken: 'fresh', tokenType: 'Bearer' });
    const { bootstrapSession } = await import('./auth');
    const { getCachedSession } = await import('./sessionCache');

    const result = await bootstrapSession();

    expect(mocks.clearSession).toHaveBeenCalledTimes(1);
    expect(mocks.issueAnonymous).toHaveBeenCalledTimes(1);
    expect(mocks.saveToken).toHaveBeenCalledWith('fresh', 'Bearer', CURRENT_ORIGIN);
    expect(getCachedSession()?.accessToken).toBe('fresh');
    // 다른 서버의 사용자였으므로 온보딩 결과도 함께 버린다
    expect(result).toEqual({ status: 'ready', hasOnboardingResult: false });
  });

  it('주소 표기만 다르고 같은 서버면 토큰을 유지한다', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:8000/';
    mocks.readSession.mockResolvedValue({
      accessToken: 'saved',
      tokenType: 'Bearer',
      user: null,
      apiOrigin: CURRENT_ORIGIN,
    });
    const { bootstrapSession } = await import('./auth');

    await bootstrapSession();

    expect(mocks.issueAnonymous).not.toHaveBeenCalled();
    expect(mocks.clearSession).not.toHaveBeenCalled();
  });

  it('apiOrigin이 없는 옛 세션은 유지하고 현재 주소를 찍어둔다', async () => {
    mocks.readSession.mockResolvedValue({
      accessToken: 'saved',
      tokenType: 'Bearer',
      user: USER,
      apiOrigin: null,
    });
    const { bootstrapSession } = await import('./auth');

    const result = await bootstrapSession();

    expect(mocks.issueAnonymous).not.toHaveBeenCalled();
    expect(mocks.clearSession).not.toHaveBeenCalled();
    expect(mocks.saveToken).toHaveBeenCalledWith('saved', 'Bearer', CURRENT_ORIGIN);
    expect(result).toEqual({ status: 'ready', hasOnboardingResult: true });
  });

  it('토큰이 없으면 발급받아 저장한다', async () => {
    mocks.readSession.mockResolvedValue(null);
    mocks.issueAnonymous.mockResolvedValue({ accessToken: 'fresh', tokenType: 'Bearer' });
    const { bootstrapSession } = await import('./auth');
    const { getCachedSession } = await import('./sessionCache');

    const result = await bootstrapSession();

    expect(mocks.saveToken).toHaveBeenCalledWith('fresh', 'Bearer', CURRENT_ORIGIN);
    expect(getCachedSession()?.accessToken).toBe('fresh');
    expect(result).toEqual({ status: 'ready', hasOnboardingResult: false });
  });

  it('응답이 없는 실패는 offline이다', async () => {
    mocks.readSession.mockResolvedValue(null);
    mocks.issueAnonymous.mockRejectedValue({ isAxiosError: true, response: undefined });
    const { bootstrapSession } = await import('./auth');

    await expect(bootstrapSession()).resolves.toEqual({
      status: 'offline',
      hasOnboardingResult: false,
    });
  });

  it('응답이 온 실패는 server-error다', async () => {
    mocks.readSession.mockResolvedValue(null);
    mocks.issueAnonymous.mockRejectedValue({ isAxiosError: true, response: { status: 500 } });
    const { bootstrapSession } = await import('./auth');

    await expect(bootstrapSession()).resolves.toEqual({
      status: 'server-error',
      hasOnboardingResult: false,
    });
  });

  it('API 주소가 URL이 아니어도 죽지 않고 문자열 그대로 비교한다', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'not a url';
    mocks.readSession.mockResolvedValue({
      accessToken: 'saved',
      tokenType: 'Bearer',
      user: null,
      apiOrigin: 'not a url',
    });
    const { bootstrapSession } = await import('./auth');

    await expect(bootstrapSession()).resolves.toEqual({ status: 'ready', hasOnboardingResult: false });
    expect(mocks.issueAnonymous).not.toHaveBeenCalled();
  });

  it('로컬 DB 읽기가 깨져도 발급 경로로 넘어간다', async () => {
    mocks.readSession.mockRejectedValue(new Error('db broken'));
    mocks.issueAnonymous.mockResolvedValue({ accessToken: 'fresh', tokenType: 'Bearer' });
    const { bootstrapSession } = await import('./auth');

    await expect(bootstrapSession()).resolves.toEqual({
      status: 'ready',
      hasOnboardingResult: false,
    });
  });

  // 저장 실패가 그대로 올라가면 classifyFailure가 response 유무만 보므로 offline이 된다.
  // 인터넷은 정상인데 네트워크 오류 화면에 갇히고, 토큰은 캐시에도 오르지 못해 WebView가 전부 401이다.
  it('로컬 DB 쓰기가 깨져도 발급받은 토큰으로 진행한다 — offline로 오인하지 않는다', async () => {
    mocks.readSession.mockResolvedValue(null);
    mocks.issueAnonymous.mockResolvedValue({ accessToken: 'fresh', tokenType: 'Bearer' });
    mocks.saveToken.mockRejectedValue(new Error('disk full'));
    const { bootstrapSession } = await import('./auth');
    const { getCachedSession } = await import('./sessionCache');

    const result = await bootstrapSession();

    expect(result).toEqual({ status: 'ready', hasOnboardingResult: false });
    expect(getCachedSession()?.accessToken).toBe('fresh');
    // 조용히 넘기면 "매 실행 새 사용자가 되는" 상태를 알 방법이 없다
    expect(mocks.captureException).toHaveBeenCalledTimes(1);
  });

  it('apiOrigin 도장을 못 찍어도 저장된 세션과 온보딩 결과를 버리지 않는다', async () => {
    mocks.readSession.mockResolvedValue({ accessToken: 'saved', tokenType: 'Bearer', user: USER, apiOrigin: null });
    mocks.saveToken.mockRejectedValue(new Error('disk full'));
    const { bootstrapSession } = await import('./auth');
    const { getCachedSession } = await import('./sessionCache');

    const result = await bootstrapSession();

    expect(mocks.issueAnonymous).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'ready', hasOnboardingResult: true });
    expect(getCachedSession()?.accessToken).toBe('saved');
  });
});

describe('reissueSession', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.saveToken.mockResolvedValue(undefined);
    process.env.EXPO_PUBLIC_API_URL = CURRENT_API_URL;
    const { setCachedSession } = await import('./sessionCache');
    setCachedSession(null);
  });

  it('저장을 못 해도 새 세션을 돌려준다 — null이면 web이 5초 뒤 빈 화면에 머문다', async () => {
    mocks.issueAnonymous.mockResolvedValue({ accessToken: 'reissued', tokenType: 'Bearer' });
    mocks.saveToken.mockRejectedValue(new Error('disk full'));
    const { reissueSession } = await import('./auth');
    const { getCachedSession } = await import('./sessionCache');

    const session = await reissueSession();

    expect(session?.accessToken).toBe('reissued');
    expect(getCachedSession()?.accessToken).toBe('reissued');
  });

  it('발급 자체가 실패하면 null이다 — 그때는 앱이 할 수 있는 일이 없다', async () => {
    mocks.issueAnonymous.mockRejectedValue(new Error('network'));
    const { reissueSession } = await import('./auth');

    await expect(reissueSession()).resolves.toBeNull();
  });
});

describe('hydratableSession', () => {
  it('저장된 행이 없으면 올릴 것이 없다', async () => {
    const { hydratableSession } = await import('./auth');

    expect(hydratableSession(null, CURRENT_ORIGIN)).toBeNull();
  });

  it('같은 서버의 세션은 그대로 올린다', async () => {
    const { hydratableSession } = await import('./auth');

    expect(hydratableSession({ accessToken: 'saved', tokenType: 'Bearer', user: USER, apiOrigin: CURRENT_ORIGIN }, CURRENT_ORIGIN)).toEqual({
      accessToken: 'saved',
      tokenType: 'Bearer',
      user: USER,
      apiOrigin: CURRENT_ORIGIN,
    });
  });

  it('다른 서버에서 발급된 세션은 올리지 않는다 — 붙여 봐야 401이다', async () => {
    const { hydratableSession } = await import('./auth');

    expect(hydratableSession({ accessToken: 'saved', tokenType: 'Bearer', user: null, apiOrigin: 'https://old.example.com' }, CURRENT_ORIGIN)).toBeNull();
  });

  it('apiOrigin이 없는 옛 세션은 지금 서버 것으로 본다', async () => {
    const { hydratableSession } = await import('./auth');

    expect(hydratableSession({ accessToken: 'saved', tokenType: 'Bearer', user: null, apiOrigin: null }, CURRENT_ORIGIN)).toMatchObject({
      accessToken: 'saved',
      apiOrigin: CURRENT_ORIGIN,
    });
  });
});

describe('hydrateSessionCache', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.EXPO_PUBLIC_API_URL = CURRENT_API_URL;
    const { setCachedSession } = await import('./sessionCache');
    setCachedSession(null);
  });

  it('저장된 세션을 캐시에 올린다 — 헤드리스 백그라운드 회차가 토큰을 붙일 수 있게 된다', async () => {
    mocks.readSession.mockResolvedValue({ accessToken: 'saved', tokenType: 'Bearer', user: USER, apiOrigin: CURRENT_ORIGIN });
    const { hydrateSessionCache } = await import('./auth');
    const { getCachedSession } = await import('./sessionCache');

    await expect(hydrateSessionCache()).resolves.toBe(true);
    expect(getCachedSession()?.accessToken).toBe('saved');
  });

  it('**토큰을 발급하지 않는다** — 헤드리스 회차가 새 사용자를 만들면 안 된다', async () => {
    mocks.readSession.mockResolvedValue(null);
    const { hydrateSessionCache } = await import('./auth');
    const { getCachedSession } = await import('./sessionCache');

    await expect(hydrateSessionCache()).resolves.toBe(false);
    expect(mocks.issueAnonymous).not.toHaveBeenCalled();
    expect(getCachedSession()).toBeNull();
  });

  it('저장을 건드리지 않는다 — 백그라운드는 읽기만 한다', async () => {
    mocks.readSession.mockResolvedValue({ accessToken: 'saved', tokenType: 'Bearer', user: null, apiOrigin: null });
    const { hydrateSessionCache } = await import('./auth');

    await expect(hydrateSessionCache()).resolves.toBe(true);
    expect(mocks.saveToken).not.toHaveBeenCalled();
    expect(mocks.clearSession).not.toHaveBeenCalled();
  });

  it('이미 캐시가 차 있으면 sqlite를 읽지 않는다', async () => {
    const { setCachedSession } = await import('./sessionCache');
    setCachedSession({ accessToken: 'cached', tokenType: 'Bearer', user: null, apiOrigin: CURRENT_ORIGIN });
    const { hydrateSessionCache } = await import('./auth');

    await expect(hydrateSessionCache()).resolves.toBe(true);
    expect(mocks.readSession).not.toHaveBeenCalled();
  });

  it('sqlite를 못 읽어도 던지지 않는다 — 백그라운드 태스크가 Failed로 끝나면 OS가 덜 깨운다', async () => {
    mocks.readSession.mockRejectedValue(new Error('db broken'));
    const { hydrateSessionCache } = await import('./auth');
    const { getCachedSession } = await import('./sessionCache');

    await expect(hydrateSessionCache()).resolves.toBe(false);
    expect(getCachedSession()).toBeNull();
  });

  it('다른 서버의 세션은 캐시에 올리지 않는다', async () => {
    mocks.readSession.mockResolvedValue({ accessToken: 'saved', tokenType: 'Bearer', user: null, apiOrigin: 'https://old.example.com' });
    const { hydrateSessionCache } = await import('./auth');
    const { getCachedSession } = await import('./sessionCache');

    await expect(hydrateSessionCache()).resolves.toBe(false);
    expect(getCachedSession()).toBeNull();
  });
});

describe('hasUsableAuthorization', () => {
  beforeEach(async () => {
    const { setCachedSession } = await import('./sessionCache');
    setCachedSession(null);
  });

  it('앱 토큰이 있으면 보낼 가치가 있다', async () => {
    const { setCachedSession } = await import('./sessionCache');
    setCachedSession({ accessToken: 'saved', tokenType: 'Bearer', user: null, apiOrigin: CURRENT_ORIGIN });
    const { hasUsableAuthorization } = await import('./auth');

    expect(hasUsableAuthorization(false)).toBe(true);
  });

  it('헤드리스 기동(judgeMode false)에 앱 토큰이 없으면 보낼 것이 없다', async () => {
    const { hasUsableAuthorization } = await import('./auth');

    expect(hasUsableAuthorization(false)).toBe(false);
  });

  it('심사위원용 모드가 켜져 있으면 앱 토큰이 없어도 붙일 헤더가 있다', async () => {
    const { hasUsableAuthorization } = await import('./auth');

    expect(hasUsableAuthorization(true)).toBe(true);
  });
});
