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
import { Animated, Easing, StyleSheet, View } from 'react-native';
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
  // 이 padding을 받는 화면(온보딩·result·네트워크 에러)은 전부 흰 배경이라 맞춰둔다.
  // 유색 배경 화면은 FullBleed로 이 padding 자체를 취소한다.
  return <View style={{ flex: 1, backgroundColor: '#ffffff', paddingBottom: Math.max(insets.bottom, MIN_BOTTOM_INSET) }}>{children}</View>;
}

/**
 * 가상 스플래시의 push-in 연출.
 *
 * 시작 배율을 1보다 크게 두는 이유: resizeMode가 cover라 1.0에서는 이미지가 화면에 딱 맞고,
 * 여기서 더 줄이는 방향으로는 여백이 생긴다. 1.02에서 시작해 1.08까지 밀어 넣으면
 * 어느 구간에서도 빈 틈이 보이지 않는다.
 */
const SPLASH_SCALE_FROM = 1.02;
const SPLASH_SCALE_TO = 1.05;
/** 확대에 걸리는 시간(ms). 준비가 더 빨리 끝나면 중간에 끊기지만 완만해서 튀지 않는다 */
const SPLASH_SCALE_MS = 1600;

/**
 * 가상 스플래시.
 *
 * 네이티브 스플래시를 감춘 뒤 폰트 로드와 네트워크 확인이 끝날 때까지 짧게 띄운다.
 * 정지 이미지만 두면 멈춘 화면처럼 보여서 아주 조금씩 확대해 살아 있는 느낌을 준다.
 *
 * onLayout으로 네이티브 스플래시를 감추는 책임은 호출부에 그대로 남겼다 —
 * 이 컴포넌트가 처음 그려진 시점이 곧 "네이티브 스플래시를 걷어도 되는 시점"이다.
 */
function AnimatedSplash({ onLayout }: { onLayout: () => void }) {
  // 렌더 중 ref 접근을 피하려고 지연 초기화 useState로 만든다(Toast.tsx와 같은 이유)
  const [scale] = useState(() => new Animated.Value(SPLASH_SCALE_FROM));

  useEffect(() => {
    const animation = Animated.timing(scale, {
      toValue: SPLASH_SCALE_TO,
      duration: SPLASH_SCALE_MS,
      // 처음에 빠르게 밀고 끝에서 잦아들어야 "훅 들어왔다 멈추는" 느낌이 난다
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [scale]);

  return (
    <View style={styles.splashContainer} onLayout={onLayout}>
      <Animated.Image source={splashImage} style={[styles.splashImage, { transform: [{ scale }] }]} />
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

  // 네트워크 상태 재확인과 토큰 재발급을 함께 돌린다.
  // 서버 오류로 들어온 경우 네트워크는 이미 정상이라 refresh만으로는 아무 일도 안 일어난다.
  const bootstrapRetry = bootstrap.retry;
  const handleRetry = useCallback(() => {
    void refreshNetworkStatus();
    bootstrapRetry();
  }, [refreshNetworkStatus, bootstrapRetry]);

  if (!appReady) {
    return <AnimatedSplash onLayout={handleSplashLayout} />;
  }

  if (networkStatus === 'offline' || bootstrap.status !== 'ready') {
    // NetworkErrorScreen이 insets를 직접 읽으므로 이 갈래도 Provider 안에서 렌더해야 한다
    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <NetworkErrorScreen onRetry={handleRetry} variant={bootstrap.status === 'server-error' ? 'server' : 'offline'} />
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
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    // 네이티브 스플래시 배경(app.json의 expo-splash-screen backgroundColor)과 같은 값이어야
    // 네이티브 → 가상 스플래시로 넘어가는 순간 배경색이 튀지 않는다.
    // splash.png가 cover로 화면을 덮으므로 평소엔 보이지 않고, 이미지 디코딩 중에만 드러난다.
    flex: 1,
    backgroundColor: '#ffffff',
  },
  splashImage: {
    ...StyleSheet.absoluteFill,
    resizeMode: 'cover',
  },
});

export default Sentry.wrap(RootLayout);
