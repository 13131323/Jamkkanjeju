import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { NetworkErrorScreen } from '@/components/NetworkErrorScreen/NetworkErrorScreen';
import { initTraceId, listenFromWeb } from '@/bridge/utils';
import { buildWebViewBootstrapScript } from '@/components/HomeWebView/webViewBootstrapScript';
import { reissueWebViewAuth } from '@/components/HomeWebView/reissueWebViewAuth';
import { buildSafeAreaScript } from '@/components/HomeWebView/safeAreaScript';
import { resolveWebViewUrl } from '@/config/webUrl';
import { navigate } from '@/utils/navigate';
import { WEBVIEW_BOTTOM_INSET, webViewTopInset } from '@/styles/safeArea';

/**
 * 장소 상세. 보물찾기 step0의 "장소 상세보기"가 여기로 온다(prompt §9).
 *
 * 화면 자체는 web에 이미 있으므로(`web/src/app/map/[placeId]`) 앱은 WebView로 그걸 띄운다 —
 * 카메라를 쓰지 않는 일반 UI는 web에서 구현한다는 이 레포의 분담 그대로다(.claude/CLAUDE_APP.md).
 *
 * 헤더도 web이 그린다 — 앱이 NavigationHeader를 얹으면 web 헤더와 겹쳐 "< 장소 상세"가 두 번 보인다.
 * 그래서 이 화면은 WebView만 띄우고, 상단 안전영역은 CSS 변수로 넘겨 web이 직접 비켜 가게 한다
 * (HomeWebView와 같은 처리).
 */
export default function PlaceDetailScreen() {
  const { placeId } = useLocalSearchParams<{ placeId?: string }>();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [hasLoadError, setHasLoadError] = useState(false);

  // web의 장소 상세는 GET /api/v1/map/locations/{id}를 부르고, 그 API는 토큰이 없으면 401이다.
  // 토큰은 앱 sqlite에만 있어서 앱이 문서 실행 전에 심어줘야 한다(HomeWebView와 같은 이유·같은 스크립트).
  const authScript = buildWebViewBootstrapScript();

  // 헤더가 web에 있으므로 상단 inset도 web이 써야 한다. 하단은 루트 레이아웃이 네이티브에서 먹였다.
  // 값을 안 심으면 web의 var(--safe-area-top)이 무효값이 되어 계산식(calc)이 통째로 죽는다.
  const safeAreaScript = buildSafeAreaScript({ top: webViewTopInset(insets.top), bottom: WEBVIEW_BOTTOM_INSET });

  // onLoadEnd 콜백은 등록 시점의 클로저를 오래 들고 있으므로 항상 최신 스크립트를 읽도록 ref를 거친다.
  const authScriptRef = useRef(authScript);
  const safeAreaScriptRef = useRef(safeAreaScript);

  // 401로 세션이 재발급된 뒤 web이 옛 토큰을 들고 있지 않도록 로드 시점에 다시 심는다.
  const injectScripts = useCallback(() => {
    webViewRef.current?.injectJavaScript(authScriptRef.current);
    webViewRef.current?.injectJavaScript(safeAreaScriptRef.current);
  }, []);

  // onMessage를 꽂지 않으면 react-native-webview가 messaging을 켜지 않아
  // window.ReactNativeWebView에 postMessage를 아예 심지 않는다(RNCWebView.setMessagingEnabled).
  // 그런데 injectedJavaScriptBeforeContentLoaded 때문에 그 **전역 객체는 만들어진다**
  // (injectJavascriptObject) — 객체는 있고 메서드는 없는 상태다. 그 상태에서 web의
  // Providers가 보내는 PING이 "postMessage is not a function"으로 죽었다.
  //
  // 이 화면은 web에서 오는 요청을 처리할 일이 없지만, PING의 traceId를 받아 두면
  // 여기서 난 앱 오류를 web 로그와 같은 id로 묶을 수 있다(HomeWebView와 같은 처리).
  // listenFromWeb 호출을 콜백 안에서 한다. 렌더 중에 부르면 webViewRef를 넘기는 셈이 돼
  // react-hooks/refs가 잡는다(useHomeBridge와 같은 이유)
  const onMessage = useCallback(
    (event: WebViewMessageEvent) =>
      listenFromWeb((message) => {
        if (message.type === 'PING') initTraceId(message.traceId);
        // web 헤더의 뒤로가기. WebView가 이 경로를 첫 페이지로 열어 web 쪽에는 되돌아갈
        // 히스토리가 없다 — 앱 라우터 스택을 pop하는 건 여기서만 할 수 있다.
        if (message.type === 'NAVIGATE_BACK') navigate.back();
        // web이 401을 만났다 — 토큰은 앱만 발급할 수 있어 여기서 다시 심어 준다(reissueWebViewAuth 주석)
        if (message.type === 'AUTH_TOKEN_REQUEST') void reissueWebViewAuth(webViewRef);
      })(event),
    [],
  );

  // ref 갱신을 렌더가 아니라 여기서 하는 이유: 렌더 중 ref 쓰기는 React 순수성 위반이다.
  useEffect(() => {
    authScriptRef.current = authScript;
    safeAreaScriptRef.current = safeAreaScript;
    injectScripts();
  }, [authScript, safeAreaScript, injectScripts]);

  // placeId 없이 들어오는 건 잘못된 딥링크다. 흰 화면으로 두지 않고 홈으로 되돌린다
  // (mission/complete.tsx의 잘못된 미션 타입 처리와 같은 방식).
  if (!placeId) {
    return <Redirect href="/home" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      {hasLoadError ? (
        <NetworkErrorScreen onRetry={() => setHasLoadError(false)} />
      ) : (
        <WebView
          ref={webViewRef}
          source={{
            uri: resolveWebViewUrl(process.env.EXPO_PUBLIC_WEB_URL, __DEV__, `/map/${placeId}`, process.env.EXPO_PUBLIC_DEV_WEB_URL),
          }}
          style={{ flex: 1 }}
          // web의 첫 조회가 문서 실행 직후 나가므로 그 전에 토큰이 있어야 한다.
          // injectJavaScript는 로드 뒤에만 먹어서 여기서 먼저 심지 않으면 첫 요청이 401이 된다.
          injectedJavaScriptBeforeContentLoaded={`${authScript}\n${safeAreaScript}`}
          onLoadEnd={injectScripts}
          onMessage={onMessage}
          onError={() => setHasLoadError(true)}
        />
      )}
    </View>
  );
}
