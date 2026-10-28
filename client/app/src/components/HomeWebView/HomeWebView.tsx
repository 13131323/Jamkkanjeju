import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, View } from 'react-native';
import WebView from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveWebViewUrl } from '@/config/webUrl';
import { WEBVIEW_BOTTOM_INSET, webViewTopInset } from '@/styles/safeArea';
import { NetworkErrorScreen } from '@/components/NetworkErrorScreen/NetworkErrorScreen';
import { ShareSheet } from '@/components/Share/ShareSheet/ShareSheet';
import { useHomeResetStore } from '@/store/homeReset';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { useWebViewRecovery } from '@/hooks/useWebViewRecovery';
import { buildWebViewBootstrapScript } from './webViewBootstrapScript';
import { buildSafeAreaScript } from './safeAreaScript';
import { resolveHomeResetStrategy } from './homeResetStrategy';
import { useHomeBridge } from './useHomeBridge';

/**
 * 시트가 닫혀 있을 때 넘기는 빈 내용.
 *
 * 시트는 `visible`이 false여도 마운트된 채라 props가 필요하다. 렌더마다 새 객체를 지어 넘기지
 * 않도록 모듈 상수로 둔다 — 링크가 비면 시트는 아무것도 열지 않는다(buildShareMessage).
 */
const EMPTY_SHARE_CONTENT = { headline: '', url: '' } as const;

export function HomeWebView() {
  // 모듈 스코프에 두지 않는다 — .env가 비면 이 함수가 던지는데, 그러면 홈 화면이 아니라
  // 번들 평가가 통째로 죽어 어느 화면 때문인지 알 수 없게 된다(resolveWebViewUrl 주석).
  // 값은 환경 변수라 렌더마다 같다.
  const webEntryUrl = resolveWebViewUrl(process.env.EXPO_PUBLIC_WEB_URL, __DEV__, undefined, process.env.EXPO_PUBLIC_DEV_WEB_URL);

  const webViewRef = useRef<WebView>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  const canGoBackRef = useRef(false);
  // web이 지금 띄우고 있는 주소. 첫 onNavigationStateChange 전에는 모른다(홈 리셋 전략이 읽는다)
  const currentUrlRef = useRef<string | null>(null);
  const { onMessage, isJudgeModalOpenRef, notifyHardwareBack, shareContent, closeShareSheet } = useHomeBridge(webViewRef);
  const insets = useSafeAreaInsets();
  // 키보드가 덮는 높이. 이 화면은 web이 그리므로 WebView를 줄여서 알린다(아래 렌더 주석)
  const keyboardInset = useKeyboardInset();

  /**
   * "홈을 처음 상태로 되돌려 달라"는 신호(store/homeReset.ts). 값이 아니라 **바뀌었다는 사실**만 쓴다.
   *
   * 예전에는 이 토큰을 그대로 WebView의 key로 써서 **언제나 remount**했다. 결과는 맞지만 비용이
   * 컸다 — 네이티브 뷰와 렌더러가 버려졌다 다시 생기므로 흰 화면을 반드시 한 번 거치고, HTTP
   * 캐시가 살아 있어도 문서를 처음부터 다시 평가한다. 미션 완료 직후처럼 **web이 아직 첫
   * 페이지에 있는** 경우에는 지울 히스토리가 없어 reload로도 결과가 똑같으므로, 어느 쪽을 쓸지
   * 상황을 보고 고른다(homeResetStrategy.ts). 어느 쪽이든 JS 컨텍스트가 새로 만들어져
   * web의 QueryClient가 비므로 **캐시 신선도 보장은 달라지지 않는다.**
   */
  const homeResetToken = useHomeResetStore((state) => state.token);

  /**
   * WebView를 통째로 새로 만들 때만 바뀌는 key. 리셋 토큰을 직접 쓰지 않는 이유는 위 주석 참고.
   *
   * 이 key는 복구 훅이 함께 쥔다(useWebViewRecovery). 렌더러가 죽었을 때의 재생성과 홈 리셋의
   * remount는 **결국 같은 수단**(key 교체)이라, 카운터를 둘로 나눠 두면 한쪽이 올린 key를 다른
   * 쪽이 되돌려 remount가 조용히 사라지는 일이 생긴다. 두 요청 모두 generation을 한 칸 올린다.
   */
  const recovery = useWebViewRecovery({ feature: 'home' });
  // 이미 처리한 리셋 요청. 마운트 시점의 토큰은 "지금 화면이 곧 그 결과"라 다시 처리하지 않는다.
  const handledResetTokenRef = useRef(homeResetToken);

  useEffect(() => {
    if (handledResetTokenRef.current === homeResetToken) return;
    handledResetTokenRef.current = homeResetToken;

    const strategy = resolveHomeResetStrategy({ currentUrl: currentUrlRef.current, entryUrl: webEntryUrl, canGoBack: canGoBackRef.current });

    if (strategy === 'reload' && webViewRef.current) {
      webViewRef.current.reload();
      return;
    }

    // 새 WebView는 아직 아무 데도 가 있지 않다. 옛 인스턴스의 주소가 남아 있으면 다음 리셋이
    // 잘못된 전략을 고르므로 여기서 함께 지운다.
    currentUrlRef.current = null;
    canGoBackRef.current = false;
    recovery.recreate();
  }, [homeResetToken, webEntryUrl, recovery]);

  // 안드로이드 하드웨어 뒤로가기: 심사위원 코드 모달이 열려 있으면(web이 JUDGE_CODE_MODAL_STATE로
  // 알려 준 값) 그 뒤로가기는 웹뷰 히스토리도, 앱 종료도 아니라 "모달을 닫아 달라"는 신호다 —
  // goBack()도 부르지 않고 여기서 소비한 뒤 HARDWARE_BACK_PRESSED로 web에 되돌려 준다.
  // 모달이 없으면 기존과 같다: 웹뷰 안에 갈 곳이 있으면 웹뷰 히스토리를 따라가고,
  // 없으면(웹뷰 최상위 화면) 기본 동작(앱 종료)에 맡긴다.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isJudgeModalOpenRef.current) {
        notifyHardwareBack();
        return true;
      }
      if (!canGoBackRef.current) return false;
      webViewRef.current?.goBack();
      return true;
    });
    return () => subscription.remove();
  }, [isJudgeModalOpenRef, notifyHardwareBack]);

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

  // 재생성을 다 쓰고도 렌더러가 계속 죽으면 오류 화면으로 넘긴다. variant가 'server'인 이유:
  // 렌더러 사망은 네트워크가 아니라 기기 메모리 문제라 'offline'의 "인터넷 연결 상태를 확인하세요"가
  // 멀쩡한 와이파이를 의심하게 만든다. 둘 중에서는 사용자가 고칠 것이 없고 "잠시 후 다시 시도"가
  // 맞는 안내인 'server'가 실제 상황에 가깝다(NetworkErrorScreen/messages.ts).
  if (hasLoadError || recovery.hasGivenUp) {
    return (
      <NetworkErrorScreen
        variant={recovery.hasGivenUp ? 'server' : 'offline'}
        onRetry={() => {
          setHasLoadError(false);
          recovery.retry();
        }}
      />
    );
  }

  return (
    // 키보드가 덮는 만큼 WebView 자체를 줄인다. edge-to-edge라 창이 IME로 줄지 않아서,
    // 이걸 하지 않으면 WebView 안의 web은 키보드가 떴다는 사실을 아예 모른다 — 뷰포트가
    // 그대로라 h-dvh도 fixed inset-0도 움직이지 않아 코드 입력 모달이 키보드에 덮인다.
    // 값의 기준점과 왜 CSS 변수가 아니라 뷰 크기인지는 useKeyboardInset 주석 참고.
    <View style={{ flex: 1, paddingBottom: keyboardInset }}>
      <WebView
        key={recovery.webViewKey}
        ref={webViewRef}
        source={{ uri: webEntryUrl }}
        style={{ flex: 1 }}
        // Android 시스템 글자 크기 설정을 WebView가 그대로 따라가면 디자인 폭(px 고정)이 깨진다
        textZoom={100}
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
          // 홈 리셋이 reload로 충분한지 여기서 읽는다(homeResetStrategy.ts).
          currentUrlRef.current = state.url;
        }}
        onMessage={onMessage}
        // 렌더러 프로세스가 죽었을 때의 복구(key 교체로 재생성) + 성공 로드 시 카운터 리셋.
        // onLoad가 이 묶음에 들어 있어 위 onLoadEnd와 겹치지 않는다(useWebViewRecovery 주석).
        {...recovery.recoveryProps}
      />

      {/*
        web 화면이 SHARE_SHEET로 부탁한 공유 시트(지금은 AI 엽서 결과 화면). 협동 미션 초대가 쓰던
        그 시트를 그대로 WebView 위에 올린다 — 라인·문자·메일로 넘기는 일은 네이티브만 할 수 있다.

        **하드웨어 뒤로가기는 위 BackHandler에 분기를 더하지 않는다.** 이 시트는 RN `Modal`이라
        안드로이드에서 자기 윈도우(Dialog)를 갖고, 그 윈도우가 뒤로가기를 먼저 받아 `onRequestClose`
        (시트의 slideOut)로 넘긴다 — Activity까지 내려오지 않으므로 여기 리스너는 애초에 불리지 않는다.
        심사위원 코드 모달이 JUDGE_CODE_MODAL_STATE 왕복을 필요로 했던 건 그쪽이 **web의 DOM 모달**
        이라 네이티브에 아무 흔적이 없어서였다. 결과는 같다 — 뒤로가기는 맨 위에 뜬 것을 닫는다.
      */}
      <ShareSheet visible={shareContent !== null} content={shareContent ?? EMPTY_SHARE_CONTENT} onClose={closeShareSheet} />
    </View>
  );
}
