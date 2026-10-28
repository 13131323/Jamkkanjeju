import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { listenFromWeb } from '@/bridge/utils';
import { resolveWebViewUrl } from '@/config/webUrl';
import { DEFAULT_TREASURE_MAP_PATH } from '@/components/Treasure/TreasureHuntMap/TreasureHuntMap';
import { reissueWebViewAuth } from '@/components/HomeWebView/reissueWebViewAuth';
import { buildWebViewBootstrapScript } from '@/components/HomeWebView/webViewBootstrapScript';
import { useWebViewRecovery } from '@/hooks/useWebViewRecovery';

/**
 * 보물찾기 intro에서 지도 페이지를 미리 받아 둔다.
 * prompt §9 'Intro 화면에서 미리 지도 api 호출("시작하기" 버튼 클릭 후 대기 시간이 길지 않도록)'
 *
 * 지도는 web 페이지(`/map?mode=treasure`)이고 그 안에서 카카오 지도 SDK를 로드한다. 그래서
 * "지도 API를 미리 호출"하는 가장 직접적인 방법은 같은 URL을 화면 밖 WebView로 한 번 열어
 * HTML·JS·SDK가 WebView HTTP 캐시에 들어가게 하는 것이다. step0에 들어갈 때는 캐시에서 읽는다.
 *
 * 화면 밖 배치(opacity:0이 아니라)를 택한 이유는 TreasureHuntPhoto의 오프스크린 캡처와 같다 —
 * Android가 alpha 0인 뷰의 드로우를 생략하면서 스크립트 실행도 지연될 수 있다(styles.ts 주석 참고).
 *
 * 브릿지 핸드셰이크(PING)에 **응답하지 않는다** — PONG이 없으면 web이 위치·보물 마커를 그리지
 * 않고, 목적이 캐시 워밍이라 그대로 둔다(사용자가 보는 지도는 step0의 TreasureHuntMap이다).
 */
export function TreasureMapPrefetch() {
  const webViewRef = useRef<WebView | null>(null);

  /**
   * 렌더러가 죽어도 **다시 만들지 않는다**(`maxAttempts: 0`). 다른 WebView 화면은 2회까지 재생성해
   * 되살리지만(useWebViewRecovery) 여기만 다른 이유:
   *
   * - 렌더러를 죽이는 건 대개 메모리 압박이다. 그 와중에 **화면에 보이지도 않는** 캐시 워밍용
   *   WebView를 다시 띄우면, 사용자가 실제로 보고 있는 intro·step0이 쓸 메모리를 빼앗는다.
   * - 실패해도 사용자에게 보이는 손해는 "시작하기 후 지도가 조금 늦게 뜬다"뿐이다.
   *   `onError`를 조용히 넘기는 것과 같은 판단이다.
   *
   * 포기하면 WebView를 아예 렌더하지 않아 죽은 인스턴스가 트리에서 사라진다.
   */
  const recovery = useWebViewRecovery({ feature: 'treasure-map-prefetch', maxAttempts: 0 });

  // onMessage 자체는 꽂아야 한다. 없으면 react-native-webview가 messaging을 켜지 않아
  // web 쪽 `window.ReactNativeWebView`에 postMessage가 붙지 않는데, 주입 스크립트 때문에
  // **전역 객체는 만들어진다** — web의 sendToApp이 그 반쪽 상태를 오류로 기록하므로
  // (web/src/shared/lib/bridge/utils.ts) PING 한 번이 Sentry 오류가 된다.
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    listenFromWeb((message) => {
      // 토큰이 거절당하면 여기서도 다시 심어 준다. 이 WebView가 워밍하는 것이 401 응답이면
      // 목적("시작하기 대기 시간 단축")과 반대로 step0이 빈 지도에서 출발한다.
      if (message.type === 'AUTH_TOKEN_REQUEST') void reissueWebViewAuth(webViewRef);
      // 그 밖의 메시지는 무시한다 — PING에 답하지 않는 것이 이 컴포넌트의 설계다
    })(event);
  }, []);

  // 워밍은 부가 기능이라 실패를 알릴 화면이 없다. 조용히 그만둔다
  if (recovery.hasGivenUp) return null;

  return (
    <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <WebView
        key={recovery.webViewKey}
        ref={webViewRef}
        source={{
          uri: resolveWebViewUrl(process.env.EXPO_PUBLIC_WEB_URL, __DEV__, DEFAULT_TREASURE_MAP_PATH, process.env.EXPO_PUBLIC_DEV_WEB_URL),
        }}
        style={styles.webView}
        // Android 시스템 글자 크기 설정을 WebView가 그대로 따라가면 디자인 폭(px 고정)이 깨진다
        textZoom={100}
        // 캐시 워밍이 목적이므로 실패해도 조용히 넘어간다 — intro 화면을 방해하지 않는다
        onError={() => undefined}
        onMessage={onMessage}
        // 토큰·앱 정보를 문서 실행 전에 심는다. 빠져 있으면 워밍되는 것이 401 응답이다.
        injectedJavaScriptBeforeContentLoaded={buildWebViewBootstrapScript()}
        // 렌더러 사망을 기록하고(didCrash 포함) 이 WebView를 접는다. 재시도는 하지 않는다 — 위 주석 참고
        {...recovery.recoveryProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    // 지도 SDK가 뷰포트 크기를 보고 타일을 요청하므로 0x0이 아니라 실제 화면만 한 크기로 둔다
    left: -10000,
    top: 0,
    width: 360,
    height: 800,
  },
  webView: { flex: 1 },
});
