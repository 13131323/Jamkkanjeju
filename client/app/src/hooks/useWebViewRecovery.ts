import * as Sentry from '@sentry/react-native';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { Platform } from 'react-native';
import type { WebViewNavigationEvent, WebViewRenderProcessGoneEvent, WebViewTerminatedEvent } from 'react-native-webview/lib/WebViewTypes';
import {
  INITIAL_WEBVIEW_RECOVERY_STATE,
  MAX_RENDERER_RECREATE_ATTEMPTS,
  nextWebViewRecoveryState,
  resolveRendererLossAction,
  type WebViewRecoveryEvent,
  type WebViewRecoveryState,
} from './webViewRecoveryPolicy';

/**
 * 안드로이드가 메모리 압박으로 WebView 렌더러를 죽였을 때(iOS는 content process 종료) **WebView를
 * 다시 만들어 되살리는** 공통 배선. 판단 규칙과 그 근거는 전부 `webViewRecoveryPolicy.ts`에 있다.
 *
 * 이 앱에는 WebView가 7곳 있다(홈·쿠폰·방명록·장소·근처미션·보물지도·지도 프리페치).
 * 같은 로직을 일곱 번 복사하면 **다음에 추가되는 WebView가 조용히 빠진다** — 주입 스크립트를
 * `buildWebViewBootstrapScript()` 한 곳으로 모은 것과 같은 이유로 여기 한 곳에 둔다.
 *
 * ## 쓰는 법
 *
 * ```tsx
 * const recovery = useWebViewRecovery({ feature: 'home' });
 *
 * if (hasLoadError || recovery.hasGivenUp) {
 *   return <NetworkErrorScreen variant={recovery.hasGivenUp ? 'server' : 'offline'} onRetry={() => { setHasLoadError(false); recovery.retry(); }} />;
 * }
 * return <WebView key={recovery.webViewKey} {...recovery.recoveryProps} … />;
 * ```
 *
 * `recoveryProps`에는 `onLoad`가 들어 있다. **`onLoadEnd`가 아니라 `onLoad`인 이유**: `onLoadEnd`는
 * 실패로 끝난 로드에도 불리므로, 그걸로 카운터를 되돌리면 "성공 로드 시 리셋"이 "아무 로드나 리셋"이
 * 된다. 이 레포의 WebView 화면들은 스크립트 주입에 `onLoadEnd`를 쓰고 있어 겹치지도 않는다.
 */
export interface WebViewRecovery {
  /** `<WebView key={...}>`에 그대로 넘긴다. 값이 바뀌면 죽은 인스턴스가 버려지고 새로 만들어진다 */
  webViewKey: number;
  /** 자동 재생성을 다 쓰고 포기했다. true면 WebView 대신 오류 화면을 그린다 */
  hasGivenUp: boolean;
  /** `<WebView>`에 그대로 펼쳐 넣는 복구용 prop 묶음 */
  recoveryProps: {
    onLoad: (event: WebViewNavigationEvent) => void;
    /** Android 전용(API 26+). iOS 빌드에서는 네이티브가 이 prop을 무시한다 */
    onRenderProcessGone: (event: WebViewRenderProcessGoneEvent) => void;
    /** iOS/macOS 전용. WKWebView content process 종료 — 증상도 복구도 위와 같다 */
    onContentProcessDidTerminate: (event: WebViewTerminatedEvent) => void;
  };
  /** 오류 화면의 "다시 시도". 포기 상태가 아니면 아무 일도 하지 않는다 */
  retry: () => void;
  /** 복구와 무관한 이유로 WebView를 새로 만든다(홈 리셋의 remount 전략) */
  recreate: () => void;
}

class WebViewRendererLostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebViewRendererLostError';
  }
}

/**
 * @param feature 어느 WebView인지. Sentry 태그와 로그에만 쓴다 — **URL·토큰 같은 값은 넣지 마라**
 * @param maxAttempts 자동 재생성 허용 횟수. 기본 2회, 0이면 재시도하지 않는다
 */
export function useWebViewRecovery({ feature, maxAttempts = MAX_RENDERER_RECREATE_ATTEMPTS }: { feature: string; maxAttempts?: number }): WebViewRecovery {
  const reducer = useCallback((state: WebViewRecoveryState, event: WebViewRecoveryEvent) => nextWebViewRecoveryState(state, event, maxAttempts), [maxAttempts]);
  const [state, dispatch] = useReducer(reducer, INITIAL_WEBVIEW_RECOVERY_STATE);

  // 로그에 "몇 번째 시도인지 / 그래서 무엇을 할 것인지"를 함께 남기려면 dispatch 이전 상태가 필요하다.
  // 렌더 중 ref 쓰기는 React 순수성 위반이라 effect에서 미룬다 — 렌더러 사망 사이에는 새 WebView가
  // 마운트되고 로드되는 구간이 있어 이 갱신이 늦어 문제가 되는 경우는 없다.
  const attemptsRef = useRef(state.attempts);
  useEffect(() => {
    attemptsRef.current = state.attempts;
  }, [state.attempts]);

  const handleRendererLost = useCallback(
    (didCrash: boolean | null) => {
      const action = resolveRendererLossAction(attemptsRef.current, maxAttempts);
      // 민감 값(주소·토큰)은 남기지 않는다. didCrash만으로 "시스템이 회수한 것"과 "진짜 크래시"가 갈린다
      const detail = `feature=${feature} platform=${Platform.OS} didCrash=${didCrash ?? 'n/a'} attempts=${attemptsRef.current} action=${action}`;

      if (__DEV__) console.warn(`[WebView] 렌더러 프로세스가 사라졌습니다 — ${detail}`);
      Sentry.addBreadcrumb({ category: 'webview', level: 'warning', message: `renderer lost: ${detail}` });
      // 자동 복구가 끝난 경우만 예외로 올린다. 재생성으로 살아난 건은 breadcrumb로 충분하다
      if (action === 'give-up') Sentry.captureException(new WebViewRendererLostError(`WebView 렌더러 복구 실패 — ${detail}`));

      dispatch({ type: 'renderer-lost', didCrash });
    },
    [feature, maxAttempts],
  );

  const recoveryProps = useMemo(
    () => ({
      onLoad: () => dispatch({ type: 'load-succeeded' }),
      onRenderProcessGone: (event: WebViewRenderProcessGoneEvent) => handleRendererLost(event.nativeEvent?.didCrash ?? null),
      // iOS payload에는 didCrash가 없다. 값 자체가 오지 않는 것과 "false"는 다르므로 null로 구분한다
      onContentProcessDidTerminate: (_event: WebViewTerminatedEvent) => handleRendererLost(null),
    }),
    [handleRendererLost],
  );

  const retry = useCallback(() => dispatch({ type: 'manual-retry' }), []);
  const recreate = useCallback(() => dispatch({ type: 'recreate-requested' }), []);

  // 호출부가 이 객체를 effect 의존성에 넣는다(HomeWebView의 홈 리셋). 렌더마다 새 객체를 돌려주면
  // 그 effect가 매 렌더 돌아가므로 상태가 실제로 바뀔 때만 새로 만든다.
  return useMemo(() => ({ webViewKey: state.generation, hasGivenUp: state.hasGivenUp, recoveryProps, retry, recreate }), [state.generation, state.hasGivenUp, recoveryProps, retry, recreate]);
}
