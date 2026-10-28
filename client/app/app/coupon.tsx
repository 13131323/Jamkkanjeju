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
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { useWebViewRecovery } from '@/hooks/useWebViewRecovery';
import { WEBVIEW_BOTTOM_INSET, webViewTopInset } from '@/styles/safeArea';
import { buildCouponMapPath } from '@/utils/couponWebUrl';

/**
 * 쿠폰 사용 화면. 보물찾기 완료 화면의 "사용하러 가기"가 여기로 온다.
 *
 * 화면은 web 지도 위 바텀시트다(쿠폰사용.png = web MapView + CouponModalCard). 카메라를
 * 쓰지 않는 일반 UI는 web에서 구현한다는 분담 그대로, 앱은 WebView로 그걸 띄운다
 * (place.tsx와 같은 골격·같은 이유).
 *
 * 쿠폰 값은 completion API가 이미 app에 줬으므로 쿼리 파라미터로 넘긴다 — web이 다시 조회하지 않는다.
 *
 * **앱이 그리는 헤더·뒤로가기가 없다.** 예전에는 NavigationHeader("쿠폰 사용")를 얹었는데,
 * 지도가 화면 전체를 써야 하는 화면이라 그 줄이 지도를 잘라먹었다. 뒤로가기 아이콘과 그 옆 텍스트를
 * 함께 지웠고, 지도 위에 떠 있는 형태로도 두지 않는다 — web의 검색바가 그 자리를 쓴다.
 * 그래서 이 화면에서 나가는 길은 **안드로이드 하드웨어 뒤로가기**뿐이다(expo-router Stack이 pop한다).
 * web `/map`에는 뒤로가기·닫기 컨트롤이 없다 — `/map/[placeId]`(MapDetailPage)에는 있고 그쪽은
 * 히스토리가 없을 때 NAVIGATE_BACK을 보내지만, 지도 화면에는 그런 버튼 자체가 없다.
 */
export default function CouponScreen() {
  const { couponLocation, couponPrice, locationId, locationAddress, locationImageUrl } = useLocalSearchParams<{
    couponLocation?: string;
    couponPrice?: string;
    locationId?: string;
    locationAddress?: string;
    locationImageUrl?: string;
  }>();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  // 안드로이드가 메모리 압박으로 렌더러를 죽이면 이 자리가 빈 흰 화면으로 남는다. 복구는 재생성뿐이다
  const recovery = useWebViewRecovery({ feature: 'coupon' });
  // 키보드가 덮는 높이. edge-to-edge라 창이 IME로 줄지 않아 네이티브가 직접 줄여야 한다(useKeyboardInset)
  const keyboardInset = useKeyboardInset();

  // 지도 조회는 토큰이 없으면 401이다. 토큰은 앱 sqlite에만 있어서 문서 실행 전에 심어야 한다.
  const authScript = buildWebViewBootstrapScript();
  // 이 화면은 헤더 줄이 없다(지도가 화면 전체를 쓴다). 상단 인셋을 먹는 네이티브 뷰가 없어졌으니
  // web이 직접 비켜 가야 한다 — top을 0으로 넘기면 web 검색바가 상태바에 물린다.
  // place.tsx/mission/nearby.tsx는 여전히 헤더가 인셋을 먹는 구조라 이 화면만 다르다.
  // 하단은 루트 레이아웃이 네이티브에서 처리한다(다른 WebView 화면과 같다).
  const safeAreaScript = buildSafeAreaScript({ top: webViewTopInset(insets.top), bottom: WEBVIEW_BOTTOM_INSET });

  const authScriptRef = useRef(authScript);
  const safeAreaScriptRef = useRef(safeAreaScript);

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

  // 사용처·금액이 없으면 web이 시트를 열지 못해 지도만 남는다. 잘못된 진입이라 되돌린다.
  const price = Number(couponPrice);
  if (!couponLocation || !Number.isFinite(price) || price <= 0) {
    return <Redirect href="/home" />;
  }

  // 갈 장소가 없는 쿠폰(locationId null)은 파라미터가 아예 오지 않는다. 그때도 지도는 열되
  // web이 "장소로 이동"을 시도하지 않도록 null로 넘긴다.
  const parsedLocationId = Number(locationId);
  const path = buildCouponMapPath({
    couponLocation,
    couponPrice: price,
    locationId: locationId && Number.isInteger(parsedLocationId) ? parsedLocationId : null,
    locationAddress: locationAddress ?? null,
    locationImageUrl: locationImageUrl ?? null,
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
          onMessage={onMessage}
          onError={() => setHasLoadError(true)}
          // 렌더러가 죽으면 key를 바꿔 새로 만든다(useWebViewRecovery). 성공 로드 시 카운터 리셋(onLoad)도 이 묶음에 들어 있다
          {...recovery.recoveryProps}
        />
      )}
    </View>
  );
}
