import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler } from 'react-native';
import WebView from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveWebViewUrl } from '@/config/webUrl';
import { WEBVIEW_BOTTOM_INSET, webViewTopInset } from '@/styles/safeArea';
import { NetworkErrorScreen } from '@/components/NetworkErrorScreen/NetworkErrorScreen';
import { useHomeResetStore } from '@/store/homeReset';
import { buildWebViewBootstrapScript } from './webViewBootstrapScript';
import { buildSafeAreaScript } from './safeAreaScript';
import { useHomeBridge } from './useHomeBridge';

export function HomeWebView() {
  const webViewRef = useRef<WebView>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  const canGoBackRef = useRef(false);
  const { onMessage } = useHomeBridge(webViewRef);
  const insets = useSafeAreaInsets();

  /**
   * WebView를 통째로 새로 만들어 web을 첫 페이지로 되돌리는 신호(store/homeReset.ts).
   *
   * `reload()`가 아니라 **remount**인 이유: reload는 지금 열려 있는 주소(예: 도감 카드)를 다시
   * 불러올 뿐이라 화면이 그대로다. key를 바꾸면 새 WebView가 base URL부터 시작하고
   * web 쪽 히스토리도 함께 사라진다 — "홈으로 리셋"이 뜻하는 그대로다.
   */
  const homeResetToken = useHomeResetStore((state) => state.token);

  // 안드로이드 하드웨어 뒤로가기: 웹뷰 안에 갈 곳이 있으면 웹뷰 히스토리를 따라가고,
  // 없으면(웹뷰 최상위 화면) 기본 동작(앱 종료)에 맡긴다.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBackRef.current) return false;
      webViewRef.current?.goBack();
      return true;
    });
    return () => subscription.remove();
  }, []);

  // bottom은 루트 레이아웃이 네이티브에서 이미 먹였다(WEBVIEW_BOTTOM_INSET 주석 참고).
  // 상단만 web이 직접 처리한다. insets.top을 그대로 쓰지 않는 이유는 webViewTopInset 주석 참고 —
  // Android 첫 렌더의 0이 아래 injectedJavaScriptBeforeContentLoaded에 굳어 상태바와 글자가 겹쳤다.
  const safeAreaScript = buildSafeAreaScript({ top: webViewTopInset(insets.top), bottom: WEBVIEW_BOTTOM_INSET });

  // 부트스트랩이 스플래시 구간에서 끝난 뒤 이 화면이 렌더되므로 캐시를 동기로 읽어도 안전하다.
  // web은 이 토큰으로 앱과 같은 사용자로서 API를 호출한다.
  const authScript = buildWebViewBootstrapScript();

  // onLoadEnd·AppState 콜백은 등록 시점의 클로저를 오래 들고 있으므로,
  // 항상 최신 스크립트를 읽도록 ref를 거쳐 주입한다.
  const safeAreaScriptRef = useRef(safeAreaScript);
  const authScriptRef = useRef(authScript);

  const injectSafeArea = useCallback(() => {
    webViewRef.current?.injectJavaScript(safeAreaScriptRef.current);
  }, []);

  // 401로 세션이 갈리거나 재발급된 뒤 web이 옛 토큰을 들고 있지 않도록 로드 시점에 다시 심는다.
  const injectAuth = useCallback(() => {
    webViewRef.current?.injectJavaScript(authScriptRef.current);
  }, []);

  useEffect(() => {
    authScriptRef.current = authScript;
    injectAuth();
  }, [authScript, injectAuth]);

  // inset이 바뀔 때(회전, 네비게이션바 모드 변경) 로드된 페이지에 반영한다.
  // ref 갱신을 렌더가 아니라 여기서 하는 이유: 렌더 중 ref 쓰기는 React 순수성 위반이다.
  useEffect(() => {
    safeAreaScriptRef.current = safeAreaScript;
    injectSafeArea();
  }, [safeAreaScript, injectSafeArea]);

  // 설정에서 네비게이션바 모드를 바꾸고 돌아오면 Activity가 다시 만들어지면서
  // inset이 첫 렌더보다 늦게 도착한다. 복귀 시 한 번 더 맞춘다.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') injectSafeArea();
    });
    return () => subscription.remove();
  }, [injectSafeArea]);

  if (hasLoadError) {
    return <NetworkErrorScreen onRetry={() => setHasLoadError(false)} />;
  }

  return (
    <WebView
      key={homeResetToken}
      ref={webViewRef}
      source={{
        uri: resolveWebViewUrl(process.env.EXPO_PUBLIC_WEB_URL, __DEV__, undefined, process.env.EXPO_PUBLIC_DEV_WEB_URL),
      }}
      style={{ flex: 1 }}
      // 첫 페인트부터 변수가 있어야 콘텐츠가 상태바 아래에서 시작했다가 튀지 않는다.
      // 다만 이 값은 WebView가 페이지를 시작할 때 찍히므로, 그 뒤에 도착한 inset은 반영되지 않는다.
      // 토큰도 여기서 함께 심는다. web의 첫 API 호출이 문서 실행 직후 나가므로
      // 브릿지로 넘기면 늦어 401이 된다.
      injectedJavaScriptBeforeContentLoaded={`${authScript}\n${safeAreaScript}`}
      // injectJavaScript는 페이지가 로드된 뒤에만 먹는다. 로드 도중 도착한 inset 갱신은
      // 위 useEffect에서 흘려버리게 되므로, 로드가 끝난 시점에 현재 값으로 반드시 다시 심는다.
      onLoadEnd={() => {
        injectAuth();
        injectSafeArea();
      }}
      onError={() => setHasLoadError(true)}
      onNavigationStateChange={(state) => {
        canGoBackRef.current = state.canGoBack;
      }}
      onMessage={onMessage}
    />
  );
}
