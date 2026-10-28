import * as Sentry from '@sentry/react-native';
import { type RefObject } from 'react';
import type WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { WEB_TO_APP_MESSAGE_TYPES, WebToAppMessageSchema, type AppToWebMessage, type WebToAppMessage } from '.';

// 우선은 인라인 에러 타입 정의
class PostMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostMessageError';
  }
}

// web으로부터 받은 traceId를 모듈 레벨에서 보관
// WebView 마운트(= web 세션 시작) 시 initTraceId로 설정, WebView 언마운트까지 유지
// WebView 재마운트 시 새 PING이 전송되어 자동 갱신됨
let storedTraceId: string | null = null;

// PING 수신 시 1회 호출 — traceId 저장 + Sentry 태그 동시 처리
export function initTraceId(id: string): void {
  storedTraceId = id;
  Sentry.setTag('traceId', id);
}

// app → web: storedTraceId 자동 주입 (web의 sendToApp과 대칭 구조)
// initTraceId 전에 호출되면 traceId 미확보 상태이므로 전송하지 않음
export function sendToWeb(webViewRef: RefObject<WebView | null>, message: Omit<AppToWebMessage, 'traceId'>): void {
  if (!storedTraceId) {
    Sentry.captureException(new PostMessageError('sendToWeb: storedTraceId null — initTraceId 미호출'));
    return;
  }
  if (!webViewRef.current) {
    Sentry.captureException(new PostMessageError('sendToWeb: webViewRef.current null'));
    return;
  }
  const envelope = { ...message, traceId: storedTraceId };
  webViewRef.current.postMessage(JSON.stringify(envelope));
}

/**
 * 우리 브릿지의 봉투 모양인지. 아니면 우리에게 온 메시지가 아니다.
 *
 * `onMessage`는 그 페이지가 `ReactNativeWebView.postMessage`로 보낸 것을 전부 받으므로,
 * 서드파티 스크립트가 같은 통로를 쓰면 그것까지 계약 위반으로 기록된다.
 */
function isBridgeEnvelope(value: unknown): value is { type: string; traceId: string } {
  if (typeof value !== 'object' || value === null) return false;
  const envelope = value as { type?: unknown; traceId?: unknown };
  return typeof envelope.type === 'string' && typeof envelope.traceId === 'string';
}

// web → app 메시지 수신
// WebView onMessage prop에 직접 전달하는 핸들러를 반환
export function listenFromWeb(handler: (message: WebToAppMessage) => void): (event: WebViewMessageEvent) => void {
  return (event: WebViewMessageEvent) => {
    let rawData: unknown;

    try {
      rawData = JSON.parse(event.nativeEvent.data);
    } catch {
      console.error('[Bridge] listenFromWeb: JSON 파싱 실패', event.nativeEvent.data);
      Sentry.captureException(new PostMessageError('JSON parse failed'));
      return;
    }

    // 봉투가 아니면 우리 상대가 아니다 — 조용히 넘긴다
    if (!isBridgeEnvelope(rawData)) return;

    /**
     * **모르는 type이면 조용히 무시한다.** web이 우리보다 새 번들이라는 뜻이고, 그건 배포 순서상
     * 늘 생기는 상태다(web은 즉시 바뀌고 앱은 심사·업데이트를 기다린다).
     *
     * 예전에는 이것도 zod 실패로 묶여 `Invalid discriminator value`를 쏟아내며 진짜 계약 위반을
     * 가렸다 — docs/trouble/2026-09-07-bridge-contract-drift.md
     */
    if (!WEB_TO_APP_MESSAGE_TYPES.has(rawData.type)) {
      if (__DEV__) console.info(`[Bridge] listenFromWeb: 모르는 메시지 무시 — ${rawData.type} (앱 번들이 낡았을 수 있다: Metro를 --clear로 재시작)`);
      // 예외로 올리지는 않되(정상적인 배포 시차다) 흔적은 남긴다 — 버려진 메시지가
      // AUTH_TOKEN_REQUEST처럼 복구 경로를 담당하면 뒤에 터진 오류의 원인이 된다
      Sentry.addBreadcrumb({ category: 'bridge', level: 'warning', message: `unknown web→app message: ${rawData.type}` });
      return;
    }

    const result = WebToAppMessageSchema.safeParse(rawData);

    if (!result.success) {
      // 여기까지 왔으면 **아는 type인데 payload가 어긋난** 진짜 계약 위반이다.
      // Sentry에는 원문을 올리지 않는다(사용자 데이터가 섞일 수 있다) — 로컬 콘솔에서만 본다.
      console.error('[Bridge] listenFromWeb: Zod 검증 실패', result.error.message, JSON.stringify(rawData));
      Sentry.captureException(new PostMessageError(`Invalid message from web: ${result.error.message}`));
      return;
    }
    handler(result.data);
  };
}
/*
사용 예시 (webViewRef로 직접 수신받음)
<WebView
  ref={webViewRef}
  onMessage={listenFromWeb((msg) => {
    if (msg.type === 'PING') { ... }
  })}
/>
*/
