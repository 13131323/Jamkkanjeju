import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { initTraceId, listenFromWeb } from '@/bridge/utils';
import { buildWebViewBootstrapScript } from '@/components/HomeWebView/webViewBootstrapScript';
import { reissueWebViewAuth } from '@/components/HomeWebView/reissueWebViewAuth';
import { buildSafeAreaScript } from '@/components/HomeWebView/safeAreaScript';
import { NetworkErrorScreen } from '@/components/NetworkErrorScreen/NetworkErrorScreen';
import { resolveWebViewUrl } from '@/config/webUrl';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { useWebViewRecovery } from '@/hooks/useWebViewRecovery';
import { WEBVIEW_BOTTOM_INSET, webViewTopInset } from '@/styles/safeArea';
import { buildGuestbookWritePath, type GuestbookMissionType } from '@/utils/guestbookWebUrl';
import { navigate } from '@/utils/navigate';

/** 라우트 파라미터는 문자열로만 실린다. 정수로 못 읽으면 없는 값으로 본다 */
function toId(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : null;
}

function toMissionType(value: string | undefined): GuestbookMissionType | null {
  return value === 'treasure' || value === 'coop' ? value : null;
}

/**
 * 방명록 작성. 미션 완료 화면들의 "방명록 남기기"가 여기로 온다.
 *
 * 화면은 web에 있다(`/travel-note/write`). 카메라를 쓰지 않는 일반 UI는 web에서 구현한다는
 * 분담 그대로 앱은 WebView로 띄운다 — place.tsx·coupon.tsx와 같은 골격이다.
 *
 * NavigationHeader를 얹지 않고 상단 인셋을 web에 넘기는 이유: 이 화면은 web이 헤더를 직접
 * 그린다(TravelNoteWritePage의 Header가 `--safe-area-top`을 먹는다). coupon.tsx처럼 네이티브
 * 헤더를 올리면 제목 줄이 두 번 나온다. place.tsx가 같은 이유로 같은 처리를 하고 있다.
 *
 * 파라미터를 하나도 안 받아도 화면은 열린다 — 그때는 사용자가 장소명을 직접 적는 방명록이 된다.
 * 그래서 다른 WebView 라우트와 달리 홈으로 되돌리는 가드를 두지 않는다.
 */
export default function GuestbookWriteScreen() {
  const { placeId, placeName, missionId, missionTitle, missionType, lat, lng } = useLocalSearchParams<{
    placeId?: string;
    placeName?: string;
    missionId?: string;
    missionTitle?: string;
    missionType?: string;
    lat?: string;
    lng?: string;
  }>();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  // web 히스토리에 되돌아갈 항목이 있는가. 첫 onNavigationStateChange 전에는 모른다
  const canGoBackRef = useRef(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  // 안드로이드가 메모리 압박으로 렌더러를 죽이면 이 자리가 빈 흰 화면으로 남는다. 복구는 재생성뿐이다
  const recovery = useWebViewRecovery({ feature: 'guestbook' });
  // 키보드가 덮는 높이. edge-to-edge라 창이 IME로 줄지 않아 네이티브가 직접 줄여야 한다(useKeyboardInset)
  const keyboardInset = useKeyboardInset();

  // 방명록 저장은 토큰이 없으면 401이다. 토큰은 앱 sqlite에만 있어서 문서 실행 전에 심어야 한다.
  const authScript = buildWebViewBootstrapScript();
  const safeAreaScript = buildSafeAreaScript({ top: webViewTopInset(insets.top), bottom: WEBVIEW_BOTTOM_INSET });

  const authScriptRef = useRef(authScript);
  const safeAreaScriptRef = useRef(safeAreaScript);

  const injectScripts = useCallback(() => {
    webViewRef.current?.injectJavaScript(authScriptRef.current);
    webViewRef.current?.injectJavaScript(safeAreaScriptRef.current);
  }, []);

  // onMessage를 꽂지 않으면 react-native-webview가 messaging을 켜지 않아 window.ReactNativeWebView에
  // postMessage를 심지 않는다 — web Providers의 PING이 그 상태에서 죽는다(coupon.tsx와 같은 이유).
  //
  // NAVIGATE_BACK도 받아 두지만 이 화면에서는 안 쓴다 — web 헤더의 뒤로가기는 router.back() 대신
  // 항상 홈("/")으로 보내도록 바뀌어서(TravelNoteWritePage의 Header onBack), 새 WebView라 히스토리가
  // 없어도 그냥 홈이 뜬다. 이 분기는 place.tsx 등 다른 화면과의 대칭을 위해 남겨 둔다.
  // listenFromWeb 호출을 콜백 안에서 한다. 렌더 중에 부르면 webViewRef를 넘기는 셈이 돼
  // react-hooks/refs가 잡는다(useHomeBridge와 같은 이유)
  const onMessage = useCallback(
    (event: WebViewMessageEvent) =>
      listenFromWeb((message) => {
        if (message.type === 'PING') initTraceId(message.traceId);
        if (message.type === 'NAVIGATE_BACK') navigate.back();
        // web이 401을 만났다 — 토큰은 앱만 발급할 수 있어 여기서 다시 심어 준다(reissueWebViewAuth 주석)
        if (message.type === 'AUTH_TOKEN_REQUEST') void reissueWebViewAuth(webViewRef);
      })(event),
    [],
  );

  /**
   * 안드로이드 하드웨어 뒤로가기. 웹뷰 안에 갈 곳이 있으면 웹뷰 히스토리를 먼저 따라가고,
   * 없으면(작성 1단계) 기본 동작인 화면 닫기에 맡긴다 — HomeWebView.tsx와 같은 규칙이다.
   *
   * 방명록 작성은 1·2단계가 한 화면이라 주소가 바뀌지 않는다. 대신 web이 2단계로 넘어갈 때
   * pushState로 항목을 하나 쌓아 두므로(TravelNoteWritePage의 handleNext) 그 항목이 여기서
   * 되감기고, web은 popstate를 받아 1단계로 돌아간다. 입력값은 문서가 그대로라 남는다.
   */
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBackRef.current) return false;
      webViewRef.current?.goBack();
      return true;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    authScriptRef.current = authScript;
    safeAreaScriptRef.current = safeAreaScript;
    injectScripts();
  }, [authScript, safeAreaScript, injectScripts]);

  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  const path = buildGuestbookWritePath({
    placeId: toId(placeId),
    placeName: placeName ?? null,
    missionId: toId(missionId),
    missionTitle: missionTitle ?? null,
    missionType: toMissionType(missionType),
    // 좌표는 없을 수 있다(권한 거부·측위 실패). 그때는 붙이지 않는다
    coords: lat && lng && Number.isFinite(parsedLat) && Number.isFinite(parsedLng) ? { lat: parsedLat, lng: parsedLng } : null,
  });

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
          source={{ uri: resolveWebViewUrl(process.env.EXPO_PUBLIC_WEB_URL, __DEV__, path, process.env.EXPO_PUBLIC_DEV_WEB_URL) }}
          style={{ flex: 1 }}
          // Android 시스템 글자 크기 설정을 WebView가 그대로 따라가면 디자인 폭(px 고정)이 깨진다
          textZoom={100}
          injectedJavaScriptBeforeContentLoaded={`${authScript}\n${safeAreaScript}`}
          onLoadEnd={injectScripts}
          onNavigationStateChange={(state) => {
            canGoBackRef.current = state.canGoBack;
          }}
          onMessage={onMessage}
          onError={() => setHasLoadError(true)}
          // 렌더러가 죽으면 key를 바꿔 새로 만든다(useWebViewRecovery). 성공 로드 시 카운터 리셋(onLoad)도 이 묶음에 들어 있다
          {...recovery.recoveryProps}
        />
      )}
    </View>
  );
}
