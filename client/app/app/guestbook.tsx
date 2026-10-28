import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { initTraceId, listenFromWeb } from '@/bridge/utils';
import { buildWebViewBootstrapScript } from '@/components/HomeWebView/webViewBootstrapScript';
import { reissueWebViewAuth } from '@/components/HomeWebView/reissueWebViewAuth';
import { buildSafeAreaScript } from '@/components/HomeWebView/safeAreaScript';
import { NetworkErrorScreen } from '@/components/NetworkErrorScreen/NetworkErrorScreen';
import { resolveWebViewUrl } from '@/config/webUrl';
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
  const [hasLoadError, setHasLoadError] = useState(false);

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
  // NAVIGATE_BACK도 함께 받는다. 이 화면은 네이티브 헤더가 없어서 web 헤더의 뒤로가기가 유일한
  // 출구인데, 지금 web은 router.back()을 부른다 — 새 WebView라 되돌아갈 히스토리가 없어 아무 일도
  // 일어나지 않는다. web이 브릿지로 바꾸면 이 처리가 곧바로 동작한다(place.tsx가 이미 그 형태다).
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
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      {hasLoadError ? (
        <NetworkErrorScreen onRetry={() => setHasLoadError(false)} />
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: resolveWebViewUrl(process.env.EXPO_PUBLIC_WEB_URL, __DEV__, path, process.env.EXPO_PUBLIC_DEV_WEB_URL) }}
          style={{ flex: 1 }}
          injectedJavaScriptBeforeContentLoaded={`${authScript}\n${safeAreaScript}`}
          onLoadEnd={injectScripts}
          onMessage={onMessage}
          onError={() => setHasLoadError(true)}
        />
      )}
    </View>
  );
}
