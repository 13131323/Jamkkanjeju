import { afterEach, describe, expect, it, vi } from 'vitest';

const bridge = vi.hoisted(() => ({ isAppWebView: vi.fn(), sendToApp: vi.fn() }));
vi.mock('@shared/lib/bridge/utils', () => bridge);

const AUTH_READY_EVENT = 'tamnalog:auth-ready';

/**
 * jsdom을 쓰지 않는다(설치돼 있지 않고, 이 모듈이 필요한 것은 이벤트 통로 하나뿐이다).
 * Node의 EventTarget을 window로 심으면 addEventListener/dispatchEvent가 그대로 동작한다 —
 * shared/lib/bridge/utils.test.ts가 전역을 stub하는 것과 같은 방식이다.
 */
function stubWindow() {
  const target = new EventTarget();
  vi.stubGlobal('window', target);
  return { fireAuthReady: () => target.dispatchEvent(new Event(AUTH_READY_EVENT)) };
}

/**
 * 토큰 재발급 요청.
 *
 * web은 토큰을 발급할 수 없어서(앱과 다른 사용자가 만들어진다) 401을 만나면 앱에 부탁하는 것이
 * 유일한 복구 경로다. 여기서 지켜야 하는 성질이 세 가지다:
 *   1. WebView 밖에서는 기다리지 않는다(부탁할 앱이 없다)
 *   2. 동시에 터진 401이 요청을 여러 번 보내지 않는다 — 익명 사용자가 그만큼 만들어진다
 *   3. 응답이 없으면 시간 안에 포기한다
 */
describe('requestAuthReissue', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
    bridge.isAppWebView.mockReset();
    bridge.sendToApp.mockReset();
  });

  /** 모듈 스코프의 진행 중 요청이 테스트 간에 남지 않도록 매번 새로 불러온다 */
  async function loadModule() {
    return (await import('./reissueToken')).requestAuthReissue;
  }

  it('WebView 밖에서는 곧바로 false — 부탁할 앱이 없으므로 기다리지 않는다', async () => {
    bridge.isAppWebView.mockReturnValue(false);
    stubWindow();
    const requestAuthReissue = await loadModule();

    await expect(requestAuthReissue()).resolves.toBe(false);
    expect(bridge.sendToApp).not.toHaveBeenCalled();
  });

  it('앱이 토큰을 심으면(auth-ready) true', async () => {
    bridge.isAppWebView.mockReturnValue(true);
    const { fireAuthReady } = stubWindow();
    const requestAuthReissue = await loadModule();

    const pending = requestAuthReissue();
    expect(bridge.sendToApp).toHaveBeenCalledWith({ type: 'AUTH_TOKEN_REQUEST', payload: {} });

    fireAuthReady();

    await expect(pending).resolves.toBe(true);
  });

  it('동시에 여러 번 불러도 앱에는 한 번만 부탁한다', async () => {
    bridge.isAppWebView.mockReturnValue(true);
    const { fireAuthReady } = stubWindow();
    const requestAuthReissue = await loadModule();

    // 마이페이지는 진입 시 요약·도감·미션을 함께 부른다 — 401이 한꺼번에 터지는 모양
    const all = [requestAuthReissue(), requestAuthReissue(), requestAuthReissue()];
    fireAuthReady();

    await expect(Promise.all(all)).resolves.toEqual([true, true, true]);
    expect(bridge.sendToApp).toHaveBeenCalledTimes(1);
  });

  it('응답이 없으면 타임아웃으로 false — 401이 호출부에 그대로 전달된다', async () => {
    vi.useFakeTimers();
    bridge.isAppWebView.mockReturnValue(true);
    // 여기서는 앱이 응답하지 않는 상황을 보므로 auth-ready를 쏘지 않는다
    stubWindow();
    const requestAuthReissue = await loadModule();

    const pending = requestAuthReissue();
    await vi.advanceTimersByTimeAsync(5000);

    await expect(pending).resolves.toBe(false);
  });

  it('한 번 끝난 뒤의 요청은 앱에 다시 부탁한다 — 새 토큰으로도 401이면 같은 답을 재사용해선 안 된다', async () => {
    bridge.isAppWebView.mockReturnValue(true);
    const { fireAuthReady } = stubWindow();
    const requestAuthReissue = await loadModule();

    const first = requestAuthReissue();
    fireAuthReady();
    await expect(first).resolves.toBe(true);

    const second = requestAuthReissue();
    fireAuthReady();
    await expect(second).resolves.toBe(true);

    expect(bridge.sendToApp).toHaveBeenCalledTimes(2);
  });
});
