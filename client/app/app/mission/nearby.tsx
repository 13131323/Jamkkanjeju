import { Redirect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { NavigationHeader } from '@/components/NavigationHeader/NavigationHeader';
import { NetworkErrorScreen } from '@/components/NetworkErrorScreen/NetworkErrorScreen';
import { initTraceId, listenFromWeb } from '@/bridge/utils';
import { buildWebViewBootstrapScript } from '@/components/HomeWebView/webViewBootstrapScript';
import { reissueWebViewAuth } from '@/components/HomeWebView/reissueWebViewAuth';
import { buildSafeAreaScript } from '@/components/HomeWebView/safeAreaScript';
import { resolveWebViewUrl } from '@/config/webUrl';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { useWebViewRecovery } from '@/hooks/useWebViewRecovery';
import { WEBVIEW_BOTTOM_INSET } from '@/styles/safeArea';
import { buildNearbyMissionMapPath, type NearbyMissionListType } from '@/utils/missionListWebUrl';
import { navigate } from '@/utils/navigate';

const HEADER_TITLE: Record<NearbyMissionListType, string> = {
  treasure: '근처 보물찾기',
  coop: '근처 협동미션',
};

/**
 * 근처 미션 목록. 완료 화면의 "근처에서 할 수 있는 보물 찾기 > 더보기"가 여기로 온다.
 *
 * 화면은 web 지도 위 목록 시트다(web의 FilteredMissionModalCard). 카메라를 쓰지 않는 일반
 * UI는 web에서 구현한다는 분담 그대로, 앱은 WebView로 그걸 띄운다 — coupon.tsx와 같은 골격이다.
 *
 * `/coupon`을 재사용하지 않은 이유: 그 화면은 사용처·금액이 없으면 홈으로 되돌리고(쿠폰 시트를
 * 여는 것이 존재 이유다) 헤더도 "쿠폰 사용"으로 고정이다. 목록 진입을 거기에 태우면 그 계약을
 * 깨야 한다. place.tsx → coupon.tsx가 이미 "같은 골격의 형제 라우트"를 쓰고 있어 그 선례를 따랐다.
 */
export default function NearbyMissionsScreen() {
  const { missionType, lat, lng } = useLocalSearchParams<{ missionType?: string; lat?: string; lng?: string }>();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  // 안드로이드가 메모리 압박으로 렌더러를 죽이면 이 자리가 빈 흰 화면으로 남는다. 복구는 재생성뿐이다
  const recovery = useWebViewRecovery({ feature: 'mission-nearby' });
  // 키보드가 덮는 높이. edge-to-edge라 창이 IME로 줄지 않아 네이티브가 직접 줄여야 한다(useKeyboardInset)
  const keyboardInset = useKeyboardInset();

  // 지도·미션 조회는 토큰이 없으면 401이다. 토큰은 앱 sqlite에만 있어서 문서 실행 전에 심어야 한다.
  const authScript = buildWebViewBootstrapScript();
  // 상단은 NavigationHeader가, 하단은 루트 레이아웃이 이미 inset을 먹였다(coupon.tsx와 같다)
  const safeAreaScript = buildSafeAreaScript({ top: 0, bottom: WEBVIEW_BOTTOM_INSET });

  const authScriptRef = useRef(authScript);
  const safeAreaScriptRef = useRef(safeAreaScript);

  const injectScripts = useCallback(() => {
    webViewRef.current?.injectJavaScript(authScriptRef.current);
    webViewRef.current?.injectJavaScript(safeAreaScriptRef.current);
  }, []);

  // onMessage를 꽂지 않으면 react-native-webview가 messaging을 켜지 않아 window.ReactNativeWebView에
  // postMessage를 심지 않는다 — web Providers의 PING이 그 상태에서 죽는다(coupon.tsx와 같은 이유).
  // listenFromWeb 호출을 콜백 안에서 한다. 렌더 중에 부르면 webViewRef를 넘기는 셈이 돼
  // react-hooks/refs가 잡는다(useHomeBridge와 같은 이유)
  const onMessage = useCallback(
    (event: WebViewMessageEvent) =>
      listenFromWeb((message) => {
        if (message.type === 'PING') initTraceId(message.traceId);
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

  // 미션 종류가 없으면 어떤 목록을 열지 정할 수 없다. 흰 화면으로 두지 않고 되돌린다(place.tsx와 같은 처리).
  if (missionType !== 'treasure' && missionType !== 'coop') {
    return <Redirect href="/home" />;
  }

  // 좌표는 없을 수 있다(권한 거부·측위 실패). 그때는 붙이지 않고 web이 제주 중심으로 열게 둔다.
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  const coords = lat && lng && Number.isFinite(parsedLat) && Number.isFinite(parsedLng) ? { lat: parsedLat, lng: parsedLng } : null;
  const path = buildNearbyMissionMapPath({ missionType, coords });

  return (
    // 키보드가 덮는 만큼 이 화면을 줄인다. 줄지 않으면 WebView 안의 web은 키보드가 떴다는 사실
    // 자체를 몰라 입력칸이 그대로 덮인다 — 홈과 같은 처리다(useKeyboardInset)
    <View style={{ flex: 1, backgroundColor: '#ffffff', paddingBottom: keyboardInset }}>
      <View style={{ paddingTop: insets.top }}>
        <NavigationHeader title={HEADER_TITLE[missionType]} onBack={() => navigate.back()} />
      </View>

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
          onMessage={onMessage}
          onError={() => setHasLoadError(true)}
          // 렌더러가 죽으면 key를 바꿔 새로 만든다(useWebViewRecovery). 성공 로드 시 카운터 리셋(onLoad)도 이 묶음에 들어 있다
          {...recovery.recoveryProps}
        />
      )}
    </View>
  );
}
