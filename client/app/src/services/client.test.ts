import { JUDGE_ACCESS_TOKEN } from '@packages/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// 정적 import다. beforeEach 안에서 동적으로 부르면 이 두 모듈(zustand·shared 배럴)의 첫
// transform 비용이 훅 안에서 발생해 vitest 기본 hookTimeout(10초)에 걸린다.
import { useJudgeModeStore } from '@/store/judgeMode';

const dbMocks = vi.hoisted(() => ({ clearSession: vi.fn() }));

vi.mock('@/db/session', () => ({ clearSession: dbMocks.clearSession }));

/** 등록된 request 인터셉터를 직접 꺼내 실행한다(네트워크를 타지 않는다) */
async function runRequestInterceptor(instance: any, config: any) {
  const handler = instance.interceptors.request.handlers[0];
  return handler.fulfilled(config);
}

function runResponseErrorInterceptor(instance: any, error: any) {
  const handler = instance.interceptors.response.handlers[0];
  return handler.rejected(error);
}

describe('axios 인스턴스', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { setCachedSession } = await import('./sessionCache');
    setCachedSession(null);

    useJudgeModeStore.setState({ enabled: false });
  });

  it('토큰이 없으면 Authorization을 붙이지 않는다', async () => {
    const axiosInstance = (await import('./client')).default;

    const config = await runRequestInterceptor(axiosInstance, { headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
  });

  it('토큰이 있으면 Authorization을 붙인다', async () => {
    const { setCachedSession } = await import('./sessionCache');
    setCachedSession({ accessToken: 'abc', tokenType: 'Bearer', user: null, apiOrigin: 'http://localhost:8000' });
    const axiosInstance = (await import('./client')).default;

    const config = await runRequestInterceptor(axiosInstance, { headers: {} });

    expect(config.headers.Authorization).toBe('Bearer abc');
  });

  // 심사위원용 모드가 켜지면 web과 같은 규칙으로 심사위원 토큰이 앱 토큰을 이긴다.
  // 이래야 홈(web)이 보여 준 "진행중인 미션"을 앱이 같은 사용자로 이어받는다.
  it('심사위원용 모드가 켜져 있으면 심사위원 토큰을 붙인다', async () => {
    const { setCachedSession } = await import('./sessionCache');
    setCachedSession({ accessToken: 'abc', tokenType: 'Bearer', user: null, apiOrigin: 'http://localhost:8000' });
    useJudgeModeStore.setState({ enabled: true });
    const axiosInstance = (await import('./client')).default;

    const config = await runRequestInterceptor(axiosInstance, { headers: {} });

    expect(config.headers.Authorization).toBe(`Bearer ${JUDGE_ACCESS_TOKEN}`);
  });

  it('모드를 끄면 다시 앱 토큰을 붙인다', async () => {
    const { setCachedSession } = await import('./sessionCache');
    setCachedSession({ accessToken: 'abc', tokenType: 'Bearer', user: null, apiOrigin: 'http://localhost:8000' });
    useJudgeModeStore.setState({ enabled: true });
    const axiosInstance = (await import('./client')).default;

    useJudgeModeStore.setState({ enabled: false });
    const config = await runRequestInterceptor(axiosInstance, { headers: {} });

    expect(config.headers.Authorization).toBe('Bearer abc');
  });

  it('앱 토큰이 거절당해 401이면 세션을 지운다', async () => {
    const axiosInstance = (await import('./client')).default;
    const { setCachedSession, getCachedSession } = await import('./sessionCache');
    setCachedSession({ accessToken: 'abc', tokenType: 'Bearer', user: null, apiOrigin: 'http://localhost:8000' });

    const rejected = runResponseErrorInterceptor(axiosInstance, { response: { status: 401 }, config: { headers: { Authorization: 'Bearer abc' } } });

    await expect(rejected).rejects.toBeDefined();
    expect(dbMocks.clearSession).toHaveBeenCalledTimes(1);
    expect(getCachedSession()).toBeNull();
  });

  // 심사위원 토큰의 401은 "서버에 목업 사용자가 없다"는 뜻이다.
  // 여기서 앱 세션을 지우면 모드를 끄는 순간 새 익명 사용자가 되어 진행도를 잃는다.
  it('심사위원 토큰이 거절당한 401로는 앱 세션을 지우지 않는다', async () => {
    const { setCachedSession, getCachedSession } = await import('./sessionCache');
    setCachedSession({ accessToken: 'abc', tokenType: 'Bearer', user: null, apiOrigin: 'http://localhost:8000' });
    useJudgeModeStore.setState({ enabled: true });
    const axiosInstance = (await import('./client')).default;

    const rejected = runResponseErrorInterceptor(axiosInstance, { response: { status: 401 }, config: { headers: { Authorization: `Bearer ${JUDGE_ACCESS_TOKEN}` } } });

    await expect(rejected).rejects.toBeDefined();
    expect(dbMocks.clearSession).not.toHaveBeenCalled();
    expect(getCachedSession()).not.toBeNull();
  });

  // 헤드리스 백그라운드 실행(gpsBackgroundTask.ts)은 부트스트랩이 돌지 않아 토큰 없이 나간다.
  // 그 401은 저장된 토큰에 대해 아무것도 말해 주지 않는다.
  it('토큰 없이 나간 요청의 401로는 저장된 세션을 지우지 않는다', async () => {
    const axiosInstance = (await import('./client')).default;
    const { setCachedSession, getCachedSession } = await import('./sessionCache');
    setCachedSession({ accessToken: 'abc', tokenType: 'Bearer', user: null, apiOrigin: 'http://localhost:8000' });

    const rejected = runResponseErrorInterceptor(axiosInstance, { response: { status: 401 }, config: { headers: {} } });

    await expect(rejected).rejects.toBeDefined();
    expect(dbMocks.clearSession).not.toHaveBeenCalled();
    expect(getCachedSession()).not.toBeNull();
  });

  it('401이 아니면 세션을 건드리지 않는다', async () => {
    const axiosInstance = (await import('./client')).default;
    const { setCachedSession } = await import('./sessionCache');
    setCachedSession({ accessToken: 'abc', tokenType: 'Bearer', user: null, apiOrigin: 'http://localhost:8000' });

    await expect(runResponseErrorInterceptor(axiosInstance, { response: { status: 500 }, config: { headers: { Authorization: 'Bearer abc' } } })).rejects.toBeDefined();
    expect(dbMocks.clearSession).not.toHaveBeenCalled();
  });
});

/**
 * 사진 업로드가 조용히 실패하던 자리다.
 *
 * axios 1.x는 데이터가 FormData여도 Content-Type에 'application/json'이 섞여 있으면 본문을
 * JSON으로 직렬화한다. 인스턴스 기본 헤더에 그 값이 박혀 있으면 파일 파트가 통째로 사라진다.
 */
describe('orvalClient — 파일 업로드', () => {
  it('인스턴스 기본 헤더에 Content-Type을 박아 두지 않는다', async () => {
    const axiosInstance = (await import('./client')).default;

    const defaults = axiosInstance.defaults.headers as unknown as Record<string, unknown>;
    expect(defaults['Content-Type']).toBeUndefined();
  });

  it('FormData를 보낼 때는 Content-Type을 지운다 — boundary는 플랫폼이 붙여야 한다', async () => {
    const module = await import('./client');
    const request = vi.spyOn(module.default, 'request').mockResolvedValue({ data: undefined } as never);

    const form = new FormData();
    form.append('picture', 'file');

    await module.orvalClient({ url: '/upload', method: 'POST', headers: { 'Content-Type': 'multipart/form-data' }, data: form });

    const sent = request.mock.calls[0][0] as { headers?: Record<string, unknown> };
    expect(Object.keys(sent.headers ?? {}).some((key) => key.toLowerCase() === 'content-type')).toBe(false);
    request.mockRestore();
  });

  it('FormData가 아니면 헤더를 그대로 둔다', async () => {
    const module = await import('./client');
    const request = vi.spyOn(module.default, 'request').mockResolvedValue({ data: undefined } as never);

    await module.orvalClient({ url: '/json', method: 'POST', headers: { 'Content-Type': 'application/json' }, data: { a: 1 } });

    const sent = request.mock.calls[0][0] as { headers?: Record<string, unknown> };
    expect(sent.headers?.['Content-Type']).toBe('application/json');
    request.mockRestore();
  });
});
