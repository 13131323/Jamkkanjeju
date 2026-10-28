import '../global.css';
import '@/services/backgroundTask'; // 전역 스코프에서 태스크 정의
// GPS 정기 저장도 같은 방식으로 정의한다. 화면 모듈에 딸려 있으면 OS가 백그라운드에서
// 앱을 깨웠을 때 정의가 없어 실행이 버려진다(services/gpsBackgroundTask.ts 주석).
import '@/services/gpsBackgroundTask';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useState } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { initialWindowMetrics, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NetworkErrorScreen } from '@/components/NetworkErrorScreen/NetworkErrorScreen';
import { ToastProvider } from '@/components/Toast/Toast';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { registerStepSyncTask } from '@/services/backgroundTask';
import { registerGpsReportTask } from '@/services/gpsBackgroundTask';
import { sendStepRecord } from '@/services/stepCountSender';
import { syncUnsentRecords } from '@/services/stepSyncService';
import { MIN_BOTTOM_INSET } from '@/styles/safeArea';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  release: Constants.expoConfig?.version,
  tracesSampleRate: 0,
});

const queryClient = new QueryClient();

/** 스플래시 원본 크기. 화면 폭에 맞춰 높이를 계산할 때 쓴다 */
const SPLASH_SIZE = { width: 1080, height: 2400 };
const splashImage = require('@assets/splash.png');

/**
 * 모든 화면에 네비게이션바 안전영역을 한 번에 적용한다.
 *
 * 하단만 전역인 이유: 네비게이션바는 어느 화면에서든 콘텐츠를 가리면 안 되는 반면,
 * 상단은 화면마다 배경이 상태바 뒤까지 이어져야 하는지가 달라서 화면이 직접 정한다.
 * 여기서 넣는 건 기기가 요구하는 여백뿐이고, 디자인상의 여백은 각 화면이 따로 갖는다.
 * 화면 끝까지 그려야 하는 화면은 FullBleed로 이 padding을 취소한다.
 * (SafeAreaProvider의 자식이어야 useSafeAreaInsets를 쓸 수 있어 컴포넌트로 분리했다)
 */
function SafeAreaPadding({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  // 배경을 비워두면 하단 inset 띄에 안드로이드 윈도우 배경이 비친다.
  // 이 padding을 받는 화면(온보딩·result 등)은 전부 흰 배경이라 맞춰둔다.
  // 네트워크 오류 화면은 여기 밖에서 그려진다(전체 화면을 덮어야 해서 안전영역을 직접 읽는다).
  // 유색 배경 화면은 FullBleed로 이 padding 자체를 취소한다.
  return <View style={{ flex: 1, backgroundColor: '#ffffff', paddingBottom: Math.max(insets.bottom, MIN_BOTTOM_INSET) }}>{children}</View>;
}

/**
 * 가상 스플래시.
 *
 * 네이티브 스플래시를 감춘 뒤 폰트 로드와 네트워크 확인이 끝날 때까지 짧게 띄운다.
 * 이미지는 확대 없이 그대로 둔다 — 네이티브 스플래시에서 넘어올 때 크기가 달라지면 화면이 튄다.
 *
 * onLayout으로 네이티브 스플래시를 감추는 책임은 호출부에 그대로 남겼다 —
 * 이 컴포넌트가 처음 그려진 시점이 곧 "네이티브 스플래시를 걷어도 되는 시점"이다.
 *
 * 네비게이션바를 비켜 가지 않는다(사용자 결정) — 바 위에서 끝나게 하려면 그만큼 이미지를 줄여야 하고,
 * 그러면 원본 비율과 어긋난 만큼이 잘려 나간다. 화면을 꽉 채우는 쪽을 택했다.
 */
function AppSplash({ onLayout }: { onLayout: () => void }) {
  /**
   * 화면을 덮을 크기를 **숫자로 직접 계산해 넘긴다.**
   *
   * '100%'·aspectRatio·minHeight를 섞어 쓰면 Image가 스타일을 버리고 자기 원본 크기(1080x2400)를
   * 그대로 써서 화면 한 귀퉁이만 보인다(두 번 겪었다).
   *
   * 기준 크기는 실제 레이아웃(onLayout)이다. `useWindowDimensions`는 안드로이드에서 시스템 바를 뺀
   * 값이라 edge-to-edge 컨테이너보다 작아 아래에 흰 띠가 남는다. 첫 프레임용 초기값만 시스템 바를
   * 포함하는 'screen'에서 읽는다.
   */
  const [size, setSize] = useState(() => {
    const screen = Dimensions.get('screen');
    return { width: screen.width, height: screen.height };
  });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) setSize({ width, height });
    onLayout();
  };

  // cover와 같은 계산: 두 축 중 더 많이 키워야 하는 쪽에 배율을 맞추면 남는 쪽이 잘리며 꽉 찬다
  const scale = Math.max(size.width / SPLASH_SIZE.width, size.height / SPLASH_SIZE.height);

  return (
    <View style={styles.splashContainer} onLayout={handleLayout}>
      <Image source={splashImage} style={[styles.splashImage, { width: Math.ceil(SPLASH_SIZE.width * scale), height: Math.ceil(SPLASH_SIZE.height * scale) }]} />
    </View>
  );
}

function RootLayout() {
  /**
   * 여기 실린 폰트가 **전부 로드되기 전에는 어떤 화면도 렌더되지 않는다**(아래 appReady 게이트).
   * 그래서 쓰지 않는 굵기를 올려 두면 시작 시간과 APK 크기를 그만큼 그냥 낸다.
   *
   * Thin·ExtraLight·Light·ExtraBold를 뺐다 — 전수 조사에서 사용처가 **0곳**이었고 합계 10.7MB다
   * (`fontFamily: 'Pretendard-*'` 지정과 `font-pretendard-*` 유틸 양쪽을 봤다).
   * 굵기를 새로 쓰려면 여기와 tailwind.config.js의 fontFamily에 함께 추가해야 한다.
   */
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Regular': require('@assets/fonts/Pretendard-Regular.ttf'),
    'Pretendard-Medium': require('@assets/fonts/Pretendard-Medium.ttf'),
    'Pretendard-SemiBold': require('@assets/fonts/Pretendard-SemiBold.ttf'),
    'Pretendard-Bold': require('@assets/fonts/Pretendard-Bold.ttf'),
    'Pretendard-Black': require('@assets/fonts/Pretendard-Black.ttf'),
  });

  const { status: networkStatus, refresh: refreshNetworkStatus } = useNetworkStatus();
  const bootstrap = useAppBootstrap();
  const fontsReady = fontsLoaded || Boolean(fontError);
  // 부트스트랩까지 끝나야 index가 온보딩 여부를 판단할 수 있다.
  const appReady = fontsReady && networkStatus !== 'checking' && bootstrap.status !== 'checking';

  // 백그라운드 태스크 등록 + 포그라운드 동기화 fallback
  useEffect(() => {
    if (!appReady) return;
    void registerStepSyncTask();
    // 백그라운드에서도 좌표를 계속 저장한다. 주기는 OS가 정하므로 10분은 요청값이다
    // (services/gpsBackgroundTask.ts 주석에 플랫폼별 실제 주기를 적어 뒀다).
    void registerGpsReportTask();
    void syncUnsentRecords(sendStepRecord);
  }, [appReady]);
  const handleSplashLayout = useCallback(() => {
    SplashScreen.hide();
  }, []);

  // 부트스트랩 실패의 재시도: 네트워크 상태 재확인과 토큰 재발급을 함께 돌린다.
  // 서버 오류로 들어온 경우 네트워크는 이미 정상이라 refresh만으로는 아무 일도 안 일어난다.
  const bootstrapRetry = bootstrap.retry;
  const handleBootstrapRetry = useCallback(() => {
    void refreshNetworkStatus();
    bootstrapRetry();
  }, [refreshNetworkStatus, bootstrapRetry]);

  /**
   * 오프라인 오버레이의 재시도: **네트워크만 다시 읽는다.**
   *
   * 여기서 `bootstrap.retry`를 함께 부르면 안 된다. 그 함수는 상태를 'checking'으로 되돌려
   * `appReady`를 false로 만들고, 그러면 아래 스플래시 갈래가 Stack을 통째로 언마운트한다 —
   * 오버레이로 화면을 지켜 놓고 재시도 버튼이 그 화면을 날리는 꼴이 된다.
   * 이 갈래는 이미 세션이 준비된 뒤라 다시 발급받을 이유도 없다.
   */
  const handleNetworkRetry = useCallback(() => {
    void refreshNetworkStatus();
  }, [refreshNetworkStatus]);

  if (!appReady) {
    return <AppSplash onLayout={handleSplashLayout} />;
  }

  /**
   * 부트스트랩 실패는 화면을 통째로 막는다.
   *
   * 세션이 없으면 어느 화면도 자기 데이터를 열 수 없어 뒤에 무엇을 띄워 봐야 의미가 없다.
   * 게다가 이 판정은 **앱 시작 때 한 번뿐이라**(useAppBootstrap의 effect는 재시도로만 다시 돈다)
   * 이 갈래에 들어오는 시점에는 지켜 줄 화면 자체가 아직 없다.
   * NetworkErrorScreen이 insets를 직접 읽으므로 이 갈래도 Provider 안에서 렌더해야 한다.
   */
  if (bootstrap.status !== 'ready') {
    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <NetworkErrorScreen onRetry={handleBootstrapRetry} variant={bootstrap.status === 'server-error' ? 'server' : 'offline'} />
      </SafeAreaProvider>
    );
  }

  return (
    // initialWindowMetrics를 넘기면 첫 프레임부터 실제 inset으로 그려져 레이아웃이 튀지 않는다.
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <QueryClientProvider client={queryClient}>
        {/* Stack 밖에 둬야 화면이 바뀌어도 토스트가 살아 있고 모든 화면 위에 뜬다.
            SafeAreaPadding 밖인 이유: 토스트는 전체 화면 기준으로 배치하고
            하단 안전영역은 자기가 직접 더한다 */}
        <ToastProvider>
          <SafeAreaPadding>
            {/* 화면마다 디자인된 헤더를 직접 그리므로 네이티브 헤더는 전역으로 끈다.
                이 설정이 빠지면 expo-router 기본 헤더가 각 화면 위에 하나 더 붙는다

                animation: 'none' — 화면은 밀려 들어오지 않고 바로 뜬다.
                slide_from_right는 뒤로가기 때 방향이 반대로 뒤집혀 어색하고,
                전환 중(≈350ms)에도 새 화면이 입력을 받아 두 번째 탭이 그쪽 버튼에 꽂힌다.
                (그 연타 자체는 utils/navigate.ts의 전역 게이트가 막는다) */}
            <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="home" />
              <Stack.Screen name="mission" />
              <Stack.Screen name="place" />
              {/* 마이페이지 도감의 "함께 사진 찍기"가 브릿지로 여는 촬영 화면 */}
              <Stack.Screen name="character-photo" />
            </Stack>
          </SafeAreaPadding>
        </ToastProvider>
        <StatusBar style="auto" />
      </QueryClientProvider>
      {/* 오프라인 안내는 Stack을 **덮기만 하고 걷어내지 않는다.**

          예전에는 이 갈래에서 Stack 대신 NetworkErrorScreen을 return했는데, 그러면 루트
          네비게이터가 언마운트되면서 expo-router가 들고 있던 화면 스택이 통째로 사라진다.
          연결이 돌아와 Stack이 다시 마운트되면 초기 경로(index)부터 시작하므로, 사용자는
          보고 있던 화면이 아니라 홈으로 떨어진다 — "나갔다 들어오면 이어서 못 쓴다"의 정체가
          이것이다. 화면 안의 상태(미션 진행 중인 입력 등)도 함께 날아간다.

          오버레이는 불투명한 전체 화면이라 보이는 모습은 그대로이고(터치도 여기서 막힌다),
          연결이 돌아오면 오버레이만 사라져 원래 화면이 그 자리에 그대로 남는다.
          QueryClientProvider 바깥에 두는 이유는 이 화면이 쿼리를 쓰지 않아서이고,
          형제 중 마지막에 두는 이유는 RN에서 나중에 그려진 형제가 위에 오기 때문이다
          (토스트까지 덮어야 한다). */}
      {networkStatus === 'offline' && (
        <View style={StyleSheet.absoluteFill}>
          <NetworkErrorScreen onRetry={handleNetworkRetry} />
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    // 배경색은 네이티브 스플래시(app.json backgroundColor)와 같아야 넘어갈 때 튀지 않는다.
    // 가운데 정렬 + overflow hidden — 화면보다 큰 쪽이 중앙 기준으로 잘려 나간다(cover와 같은 결과).
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  /**
   * 크기는 AppSplash가 숫자로 계산해 넘긴다(그 주석 참고).
   *
   * 절대 위치 대신 일반 플렉스 자식인 이유: 컨테이너의 paddingBottom(네비게이션바 몫)이
   * 그대로 반영되어 이미지가 바 위에서 끝난다. 컨테이너보다 높으면 flex-end라 위로 넘치고,
   * 넘친 만큼은 overflow hidden이 잘라낸다 — 잘리는 쪽이 여백 넉넉한 하늘이라 아래 저작권 줄은 남는다.
   */
  splashImage: {
    resizeMode: 'cover',
  },
});

export default Sentry.wrap(RootLayout);
