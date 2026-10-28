import * as Sentry from '@sentry/nextjs';
import { PostMessageError } from '@shared/lib/errors';
import { traceId } from '@shared/lib/traceId';
import { APP_TO_WEB_MESSAGE_TYPES, AppToWebMessageSchema, type AppToWebMessage, type WebToAppMessage } from '.';

// React Native WebView 페이지 로드 시 전역 객체 타입 선언.
//
// postMessage가 optional인 것이 핵심이다. react-native-webview는 이 전역을 두 단계로 만든다
// (RNCWebView.java의 injectJavascriptObject / setMessagingEnabled):
//
//   1. `injectedJavaScriptBeforeContentLoaded`가 있는 모든 WebView에서
//      `window.ReactNativeWebView = window.ReactNativeWebView || {}`로 **빈 객체**를 만들고
//      injectedObjectJson만 붙인다.
//   2. postMessage는 messaging이 켜질 때만 붙는다 — WebView에 onMessage prop이 있을 때만이다.
//
// 그래서 onMessage 없는 WebView(app/app/coupon.tsx)에서는 객체는 있고 postMessage는 없는 상태가
// 정상적으로 존재한다. 타입이 postMessage를 필수로 선언하면 호출부가 그 상태를 알 수 없다.
declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage?: (message: string) => void;
      injectedObjectJson?: () => string | null;
    };
  }
}

/**
 * 앱 WebView 안에서 실행 중인지.
 *
 * sendToApp은 통로가 없으면 조용히 넘어가므로 "보냈는지"를 알려 주지 않는다. 뒤로가기처럼
 * **앱이 처리하지 않으면 web이 직접 처리해야 하는** 동작은 호출 전에 갈라야 해서 따로 둔다.
 */
export function isAppWebView(): boolean {
  return typeof window !== 'undefined' && typeof window.ReactNativeWebView?.postMessage === 'function';
}

/**
 * app으로 메시지를 보낸다. 보낼 통로가 없으면 조용히 넘어간다(일반 브라우저 실행이 그렇다).
 *
 * 통로가 반쯤 있는 경우 — 전역 객체는 있는데 postMessage가 없는 경우 — 는 다르다.
 * WebView 안이라는 뜻이므로 앱이 이 메시지를 받길 기대하는 화면인데 실제로는 버려진다.
 * 그 상태를 조용히 넘기면 "앱에서만 기능이 안 된다"를 원인 없이 만나게 되므로 Sentry에 남긴다.
 */
export function sendToApp(message: Omit<WebToAppMessage, 'traceId'>): void {
  if (typeof window === 'undefined' || !window.ReactNativeWebView) return;

  // 객체를 const로 잡아야 아래 검사가 postMessage의 타입까지 좁혀 준다.
  // (window.ReactNativeWebView.postMessage를 따로 변수에 담으면 호출 시점의 프로퍼티는 그대로
  //  optional로 남아 좁혀지지 않는다)
  const bridge = window.ReactNativeWebView;
  if (typeof bridge.postMessage !== 'function') {
    Sentry.captureException(new PostMessageError(`ReactNativeWebView.postMessage unavailable: ${message.type}`));
    return;
  }

  // message 본문 + traceId 주입 + 직렬화필수
  const envelope = { ...message, traceId };
  // 네이티브가 심은 함수라 객체를 통해 호출한다 — 떼어내면 this 바인딩이 끊길 수 있다
  bridge.postMessage(JSON.stringify(envelope));
}
/**
 * 이 메시지가 **우리 브릿지의 봉투**인지.
 *
 * `window.addEventListener('message')`는 출처를 가리지 않는다 — 확장·iframe·dev 오버레이가
 * 저마다 postMessage를 쓴다. 그것들까지 검증하면 남의 메시지가 Sentry에 쌓여 진짜 오류를 덮는다.
 * 봉투가 아니면 무시하고, 봉투인데 내용이 어긋날 때만 기록한다.
 */
function isBridgeEnvelope(value: unknown): value is { type: string; traceId: string } {
  if (typeof value !== 'object' || value === null) return false;
  const envelope = value as { type?: unknown; traceId?: unknown };
  return typeof envelope.type === 'string' && typeof envelope.traceId === 'string';
}

// App에서 온 message 받기
export function listenFromApp(handler: (message: AppToWebMessage) => void): () => void {
  // WebView 밖에서는 앱 메시지가 올 수 없다 — 리스너를 붙이지 않아 남의 postMessage를 파싱하지 않는다.
  // `isAppWebView()`가 아니라 전역 객체 존재로 판정한다: postMessage는 onMessage prop이 있는
  // WebView에만 붙으므로(위 선언 주석) isAppWebView()로 걸면 수신까지 죽는 화면이 생긴다.
  if (typeof window === 'undefined' || !window.ReactNativeWebView) return () => {};

  function handleMessage(event: MessageEvent) {
    // 브릿지는 항상 JSON 문자열을 보낸다. 객체를 넘기면 String(obj)="[object Object]"가 되어
    // 매번 파싱 실패로 기록됐다 — 객체를 보내는 쪽(확장·DevTools)은 우리 상대가 아니다.
    if (typeof event.data !== 'string') return;

    let rawData: unknown;
    try {
      rawData = JSON.parse(event.data);
    } catch {
      // 남의 JSON 문자열도 여기로 오고, 우리 것인지 가리려면 파싱이 돼야 한다 — 조용히 넘긴다
      return;
    }

    // 봉투가 아니면 남의 메시지다 — 기록하지 않는다
    if (!isBridgeEnvelope(rawData)) return;

    // 이 번들이 모르는 type이면 앱이 우리보다 새 번들이라는 뜻이다. 조용히 무시한다 —
    // 낡은 쪽이 할 수 있는 일이 없고, 오류로 남기면 남의 새 기능이 우리 로그를 채운다
    // (판단 근거는 WEB_TO_APP_MESSAGE_TYPES 주석에 있다).
    if (!APP_TO_WEB_MESSAGE_TYPES.has(rawData.type)) return;

    // zod 검증
    // safeParse: { success, data, error }
    const result = AppToWebMessageSchema.safeParse(rawData);

    if (!result.success) {
      // 여기까지 왔으면 **아는 type인데 payload가 어긋난** 진짜 계약 위반이다 — 이때만 Sentry에 남긴다
      Sentry.captureException(new PostMessageError(`Invalid message from app: ${result.error.message}`));
      return;
    }
    // 정상 파싱
    handler(result.data);
  }
  // Android WebView는 native postMessage를 document에 dispatch (bubbles:false)
  // → window 리스너만으로는 수신 불가, document도 같이 등록
  window.addEventListener('message', handleMessage);
  document.addEventListener('message', handleMessage as unknown as EventListener);
  return () => {
    window.removeEventListener('message', handleMessage);
    document.removeEventListener('message', handleMessage as unknown as EventListener);
  };
}
