import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { NetworkErrorScreen } from '@/components/NetworkErrorScreen/NetworkErrorScreen';
import { initTraceId, listenFromWeb, sendToWeb } from '@/bridge/utils';
import { buildWebViewBootstrapScript } from '@/components/HomeWebView/webViewBootstrapScript';
import { reissueWebViewAuth } from '@/components/HomeWebView/reissueWebViewAuth';
import { buildSafeAreaScript } from '@/components/HomeWebView/safeAreaScript';
import { resolveWebViewUrl } from '@/config/webUrl';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { useWebViewRecovery } from '@/hooks/useWebViewRecovery';
import { resolveMissionNavigateTarget } from '@/utils/missionNavigateTarget';
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
  // 안드로이드가 메모리 압박으로 렌더러를 죽이면 이 자리가 빈 흰 화면으로 남는다. 복구는 재생성뿐이다
  const recovery = useWebViewRecovery({ feature: 'place' });
  // 키보드가 덮는 높이. edge-to-edge라 창이 IME로 줄지 않아 네이티브가 직접 줄여야 한다(useKeyboardInset)
  const keyboardInset = useKeyboardInset();

  // web의 장소 상세는 GET /api/v1/map/locations/{id}를 부르고, 그 API는 토큰이 없으면 401이다.
  // 토큰은 앱 sqlite에만 있어서 앱이 문서 실행 전에 심어줘야 한다(HomeWebView와 같은 이유·같은 스크립트).
  const authScript = buildWebViewBootstrapScript();

  // 헤더가 web에 있으므로 상단 inset도 web이 써야 한다. 하단은 루트 레이아웃이 네이티브에서 먹였다.
  // 값을 안 심으면 web의 var(--safe-area-top)이 무효값이 되어 계산식(calc)이 통째로 죽는다.
  const safeAreaScript = buildSafeAreaScript({ top: webViewTopInset(insets.top), bottom: WEBVIEW_BOTTOM_INSET });

  // onLoadEnd 콜백은 등록 시점의 클로저를 오래 들고 있으므로 항상 최신 스크립트를 읽도록 ref를 거친다.
  const authScriptRef = useRef(authScript);
  // onMessage 클로저가 오래 사는 탓에 inset도 ref로 읽는다
  const insetsTopRef = useRef(insets.top);
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
  // PING의 traceId를 받아 두면 여기서 난 앱 오류를 web 로그와 같은 id로 묶을 수 있다(HomeWebView와 같은 처리).
  // listenFromWeb 호출을 콜백 안에서 한다. 렌더 중에 부르면 webViewRef를 넘기는 셈이 돼
  // react-hooks/refs가 잡는다(useHomeBridge와 같은 이유)
  const onMessage = useCallback(
    (event: WebViewMessageEvent) =>
      listenFromWeb((message) => {
        if (message.type === 'PING') {
          initTraceId(message.traceId);
          // 주입 스크립트만으로는 첫 페인트에 inset이 안 붙는 경우가 있다(safeAreaScript 주석).
          // 홈과 같은 브릿지 경로로 한 번 더 밀어 준다 — 두 경로가 같은 webViewTopInset을 거쳐야
          // 값이 갈리지 않는다(styles/safeArea.ts 주석).
          sendToWeb(webViewRef, { type: 'PONG', payload: { timestamp: Date.now() } });
          sendToWeb(webViewRef, { type: 'SAFE_AREA_UPDATE', payload: { top: webViewTopInset(insetsTopRef.current), bottom: WEBVIEW_BOTTOM_INSET } });
        }
        // web 헤더의 뒤로가기. WebView가 이 경로를 첫 페이지로 열어 web 쪽에는 되돌아갈
        // 히스토리가 없다 — 앱 라우터 스택을 pop하는 건 여기서만 할 수 있다.
        if (message.type === 'NAVIGATE_BACK') navigate.back();
        // web이 401을 만났다 — 토큰은 앱만 발급할 수 있어 여기서 다시 심어 준다(reissueWebViewAuth 주석)
        if (message.type === 'AUTH_TOKEN_REQUEST') void reissueWebViewAuth(webViewRef);
        // "근처에서 할 수 있는 미션"을 누르면 web이 route와 missionId를 보낸다. 미션 화면은 앱에만
        // 있으므로 홈 브릿지와 같은 방식으로 연다(useHomeBridge의 NAVIGATE와 같은 처리).
        if (message.type === 'NAVIGATE') {
          const target = resolveMissionNavigateTarget(message.payload.route, message.payload.resume);
          navigate.push({
            pathname: target.pathname,
            params: {
              ...(target.mission === undefined ? {} : { mission: target.mission }),
              ...(message.payload.missionId === undefined ? {} : { missionId: String(message.payload.missionId) }),
            },
          });
        }
      })(event),
    [],
  );

  // ref 갱신을 렌더가 아니라 여기서 하는 이유: 렌더 중 ref 쓰기는 React 순수성 위반이다.
  useEffect(() => {
    authScriptRef.current = authScript;
    safeAreaScriptRef.current = safeAreaScript;
    insetsTopRef.current = insets.top;
    injectScripts();
  }, [authScript, safeAreaScript, insets.top, injectScripts]);

  // placeId 없이 들어오는 건 잘못된 딥링크다. 흰 화면으로 두지 않고 홈으로 되돌린다
  // (mission/complete.tsx의 잘못된 미션 타입 처리와 같은 방식).
  if (!placeId) {
    return <Redirect href="/home" />;
  }

  return (
    // 키보드가 덮는 만큼 이 화면을 줄인다. 줄지 않으면 WebView 안의 web은 키보드가 떴다는 사실
    // 자체를 몰라 입력칸이 그대로 덮인다 — 홈과 같은 처리다(useKeyboardInset)
    <View style={{ flex: 1, backgroundColor: '#ffffff', paddingBottom: keyboardInset }}>
      {/* 렌더러 사망은 네트워크가 아니라 기기 메모리 문제다. 'offline'의 "인터넷 연결 상태를 확인하세요"는
          멀쩡한 와이파이를 의심하게 만들므로, 사용자가 고칠 것이 없고 "잠시 후 다시 시도"가 맞는 'server'를 쓴다 */}
      {hasLoadError || recovery.hasGivenUp ? (
        <NetworkErrorScreen
          variant={recovery.hasGivenUp ? 'server' : 'offline'}
          onRetry={() => {
            setHasLoadError(false);
            recovery.retry();
          }}
        />
      ) : (
        <WebView
          key={recovery.webViewKey}
          ref={webViewRef}
          source={{
            uri: resolveWebViewUrl(process.env.EXPO_PUBLIC_WEB_URL, __DEV__, `/map/${placeId}`, process.env.EXPO_PUBLIC_DEV_WEB_URL),
          }}
          style={{ flex: 1 }}
          // Android 시스템 글자 크기 설정을 WebView가 그대로 따라가면 디자인 폭(px 고정)이 깨진다
          textZoom={100}
          // web의 첫 조회가 문서 실행 직후 나가므로 그 전에 토큰이 있어야 한다.
          // injectJavaScript는 로드 뒤에만 먹어서 여기서 먼저 심지 않으면 첫 요청이 401이 된다.
          injectedJavaScriptBeforeContentLoaded={`${authScript}\n${safeAreaScript}`}
          onLoadEnd={injectScripts}
          onMessage={onMessage}
          onError={() => setHasLoadError(true)}
          // 렌더러가 죽으면 key를 바꿔 새로 만든다(useWebViewRecovery). 성공 로드 시 카운터 리셋(onLoad)도 이 묶음에 들어 있다
          {...recovery.recoveryProps}
        />
      )}
    </View>
  );
}
