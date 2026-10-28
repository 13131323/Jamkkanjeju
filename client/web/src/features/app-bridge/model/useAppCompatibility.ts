'use client';

import { useSyncExternalStore } from 'react';
import { readWebViewAppInfo, type WebViewAppInfo } from '@shared/api/auth/webViewToken';
import { isAppWebView } from '@shared/lib/bridge/utils';

/**
 * 이 WebView를 띄운 앱과 지금 번들이 함께 동작할 수 있는가.
 *
 * web은 원격 배포라 **앱 버전과 무관하게** 모든 기기에 최신 번들이 내려간다. 그래서 앱이 낡으면
 * 화면 전체가 데이터 없이 비는데, 그 원인을 화면에서 알 방법이 없었다
 *
 * - `app-outdated`: 앱이 앱 정보 전역을 심지 않았다 = 토큰도 심지 못하는 버전이다.
 *   `AUTH_TOKEN_REQUEST`도 그 앱의 zod union에 없어 조용히 버려지므로 복구 경로가 없다.
 * - `api-origin-mismatch`: 앱은 서버 A의 토큰을 심었는데 이 번들은 서버 B를 부른다.
 *   재발급은 매번 성공하고 401만 반복되며, 401은 Sentry에 남기지 않으므로 단서가 0이었다.
 * - `ok`: 정상. 일반 브라우저(WebView 밖)도 여기로 온다 — 앱이 없는 것은 결함이 아니다.
 */
export type AppCompatibility = 'ok' | 'app-outdated' | 'api-origin-mismatch';

/**
 * 판정 규칙. 전역을 읽는 일은 호출부(훅)가 하고 여기서는 값만 본다
 * (entities/location의 resolveDisplayLocation과 같은 분리).
 *
 * @param isWebView `postMessage`가 있는가(= 앱이 messaging을 켠 WebView인가).
 *   전역 객체 존재로 판정하지 않는 이유: 주입 스크립트만 있고 onMessage가 없는 WebView에서는
 *   객체는 만들어지고 postMessage는 없다. 그런 WebView는 앱과 주고받을 통로가 없어
 *   안내를 띄워도 사용자에게 닿지 않는다.
 * @param appInfo 앱이 심어 둔 신원. null이면 이 전역을 모르는 버전이다.
 * @param webApiOrigin 이 번들이 실제로 부르는 API origin.
 */
export function resolveAppCompatibility(isWebView: boolean, appInfo: WebViewAppInfo | null, webApiOrigin: string): AppCompatibility {
  // WebView 밖에서는 앱 정보가 없는 것이 정상이다. 여기서 끊지 않으면 일반 브라우저 접속이
  // 전부 "앱을 업데이트하세요"가 된다.
  if (!isWebView) return 'ok';

  if (!appInfo) return 'app-outdated';

  // 어느 한쪽을 읽지 못했으면 대조가 성립하지 않는다. 멀쩡한 조합을 오진하는 쪽이 더 나쁘다.
  if (!appInfo.apiOrigin || !webApiOrigin) return 'ok';

  return appInfo.apiOrigin === webApiOrigin ? 'ok' : 'api-origin-mismatch';
}

/**
 * 이 번들이 실제로 부르는 API의 origin.
 *
 * `@shared/config/env`를 쓰지 않는다. 그 모듈은 평가 시점에 검증에 실패하면 던지는데,
 * 이 판정은 루트에서 돌아 **모든 라우트**에 걸린다 — 지도와 무관한 화면(약관 등)까지
 * 그 검증에 묶이면 안 된다(web/src/app/providers.tsx의 배럴 회피 주석과 같은 이유).
 * `NEXT_PUBLIC_*`은 빌드 시점에 인라인되므로 여기서 직접 읽어도 값이 온다.
 */
export function webApiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!raw) return '';

  try {
    return new URL(raw).origin;
  } catch {
    // 파싱되지 않으면 원문끼리 비교한다 — 앱의 apiOriginOf와 같은 규칙이다
    return raw;
  }
}

/** 전역은 문서 실행 전에 심기므로 첫 렌더에 이미 정해져 있다 — 한 번 계산해 재사용한다 */
let cached: AppCompatibility | null = null;

function getSnapshot(): AppCompatibility {
  cached ??= resolveAppCompatibility(isAppWebView(), readWebViewAppInfo(), webApiOrigin());
  return cached;
}

/**
 * 서버 스냅샷. 서버에는 window가 없어 판정할 수 없으므로 `ok`로 그린다.
 *
 * useSyncExternalStore가 이 값으로 hydration하고 직후 클라이언트 스냅샷으로 바꿔 그리므로
 * 불일치 경고가 없다(useStepCount와 같은 이유·같은 방식).
 */
function getServerSnapshot(): AppCompatibility {
  return 'ok';
}

/** 판정은 실행 중에 바뀌지 않는다 — 구독할 것이 없다 */
function subscribe(): () => void {
  return () => {};
}

export function useAppCompatibility(): AppCompatibility {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
