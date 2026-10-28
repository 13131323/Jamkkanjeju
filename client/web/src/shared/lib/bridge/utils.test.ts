import { afterEach, describe, expect, it, vi } from 'vitest';
import { listenFromApp, sendToApp } from './utils';

const captureException = vi.hoisted(() => vi.fn());
vi.mock('@sentry/nextjs', () => ({ captureException }));

/**
 * react-native-webview는 `window.ReactNativeWebView`를 **두 단계로** 만든다
 * (node_modules/react-native-webview/android/.../RNCWebView.java).
 *
 * 1. injectJavascriptObject() — `injectedJavaScriptBeforeContentLoaded`가 있는 모든 WebView에서 실행된다.
 *      window.ReactNativeWebView = window.ReactNativeWebView || {};
 *      window.ReactNativeWebView.injectedObjectJson = function () { ... };
 *    즉 **postMessage 없는 객체**가 먼저 생긴다.
 * 2. postMessage는 messaging이 켜질 때만(= WebView에 onMessage prop이 있을 때만) 붙는다.
 *
 * app/app/place.tsx와 app/app/coupon.tsx는 1은 하고 2는 하지 않는다(onMessage prop이 없다).
 * 그 화면에서 providers.tsx의 PING이 나가면서 "postMessage is not a function"으로 죽었다.
 *
 * 그래서 존재 여부(`!window.ReactNativeWebView`)가 아니라 **함수인지**를 봐야 한다.
 */
afterEach(() => {
  vi.unstubAllGlobals();
  captureException.mockClear();
});

/**
 * WebView 안을 흉내 낸 전역을 심고, 앱이 보낸 message 이벤트를 쏠 수 있는 손잡이를 돌려준다.
 *
 * `listenFromApp`은 window와 document 양쪽에 같은 핸들러를 건다(Android WebView가 document로
 * dispatch하기 때문). 테스트에서 둘 다로 쏘면 핸들러가 두 번 불려 호출 횟수가 어긋나므로,
 * dispatch는 window로만 한다.
 */
function stubWebView() {
  const windowHandlers: Array<(event: { data: unknown }) => void> = [];

  vi.stubGlobal('window', {
    ReactNativeWebView: { postMessage: vi.fn() },
    addEventListener: (_type: string, handler: (event: { data: unknown }) => void) => windowHandlers.push(handler),
    removeEventListener: () => {},
  });
  vi.stubGlobal('document', { addEventListener: () => {}, removeEventListener: () => {} });

  return {
    /** 앱이 보낸 것처럼 raw 문자열(또는 아무 값)을 흘려보낸다 */
    dispatch: (data: unknown) => windowHandlers.forEach((handler) => handler({ data })),
  };
}

/** 계약대로 직렬화한 봉투 */
function envelope(type: string, payload: unknown) {
  return JSON.stringify({ type, payload, traceId: 'trace-1' });
}

describe('sendToApp', () => {
  it('WebView 밖(전역 없음)에서는 아무것도 하지 않는다', () => {
    vi.stubGlobal('window', {});
    expect(() => sendToApp({ type: 'PING', payload: { timestamp: 1 } })).not.toThrow();
  });

  it('postMessage가 있으면 traceId를 붙여 직렬화해 보낸다', () => {
    const postMessage = vi.fn();
    vi.stubGlobal('window', { ReactNativeWebView: { postMessage } });

    sendToApp({ type: 'PING', payload: { timestamp: 1 } });

    expect(postMessage).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(postMessage.mock.calls[0][0]);
    expect(sent.type).toBe('PING');
    expect(sent.payload).toEqual({ timestamp: 1 });
    expect(typeof sent.traceId).toBe('string');
  });

  it('객체는 있는데 postMessage가 없으면 던지지 않는다 — onMessage 없는 WebView가 이 모양이다', () => {
    // injectJavascriptObject()가 만든 그대로의 모양
    vi.stubGlobal('window', { ReactNativeWebView: { injectedObjectJson: () => null } });

    expect(() => sendToApp({ type: 'PING', payload: { timestamp: 1 } })).not.toThrow();
  });

  it('postMessage가 함수가 아닌 값이어도 던지지 않는다', () => {
    vi.stubGlobal('window', { ReactNativeWebView: { postMessage: 'nope' } });

    expect(() => sendToApp({ type: 'PING', payload: { timestamp: 1 } })).not.toThrow();
  });
});

/**
 * `listenFromApp`의 수신 필터.
 *
 * 이 훅은 `window.addEventListener('message')`를 쓰는데, 그 통로에는 앱 말고도 브라우저 확장·
 * iframe·dev 오버레이가 저마다 메시지를 흘린다. 예전에는 그것들까지 계약으로 검증해
 * 전부 "브릿지 오류"로 Sentry에 쌓였고, 그 노이즈가 진짜 계약 위반을 덮었다.
 *
 * 그래서 세 갈래를 구분해야 한다:
 *   남의 메시지 → 무시 / 모르는 type → 무시(상대가 더 새 번들) / 아는 type + 나쁜 payload → 기록
 */
describe('listenFromApp', () => {
  it('WebView 밖에서는 리스너를 붙이지 않는다', () => {
    vi.stubGlobal('window', {});

    const handler = vi.fn();
    // 리스너를 붙이지 않으므로 addEventListener 없는 전역에서도 던지지 않는다
    expect(() => listenFromApp(handler)()).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it('계약에 맞는 메시지는 핸들러로 넘긴다', () => {
    const { dispatch } = stubWebView();
    const handler = vi.fn();
    listenFromApp(handler);

    dispatch(envelope('LOCATION_PERMISSION_RESULT', { status: 'granted-precise' }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].payload).toEqual({ status: 'granted-precise' });
    expect(captureException).not.toHaveBeenCalled();
  });

  it('문자열이 아닌 data는 조용히 무시한다 — 확장·DevTools가 객체를 보낸다', () => {
    const { dispatch } = stubWebView();
    const handler = vi.fn();
    listenFromApp(handler);

    // 예전에는 String(obj)="[object Object]"가 되어 매번 파싱 실패로 Sentry에 올라갔다
    dispatch({ source: 'react-devtools-bridge', payload: {} });

    expect(handler).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('봉투 모양이 아닌 JSON은 조용히 무시한다', () => {
    const { dispatch } = stubWebView();
    const handler = vi.fn();
    listenFromApp(handler);

    dispatch(JSON.stringify({ hello: 'world' }));
    // traceId가 없으면 우리 봉투가 아니다
    dispatch(JSON.stringify({ type: 'LOCATION_UPDATE', payload: {} }));

    expect(handler).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('모르는 type은 조용히 무시한다 — 앱이 더 새 번들이라는 뜻이라 web이 할 수 있는 일이 없다', () => {
    const { dispatch } = stubWebView();
    const handler = vi.fn();
    listenFromApp(handler);

    dispatch(envelope('SOME_FUTURE_MESSAGE', { whatever: true }));

    expect(handler).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('아는 type인데 payload가 어긋나면 기록한다 — 이때만 진짜 계약 위반이다', () => {
    const { dispatch } = stubWebView();
    const handler = vi.fn();
    listenFromApp(handler);

    // lat/lng이 숫자여야 한다
    dispatch(envelope('LOCATION_UPDATE', { lat: 'north', lng: 126.5, accuracy: 0, timestamp: 0 }));

    expect(handler).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});
