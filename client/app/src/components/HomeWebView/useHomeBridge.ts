import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { AppState } from 'react-native';
import type WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { initTraceId, listenFromWeb, sendToWeb } from '@/bridge/utils';
import { useToast } from '@/components/Toast/Toast';
import { TOAST_WEBVIEW_CTA_CLEARANCE } from '@/components/Toast/styles';
import type { LocationPermissionStatus } from '@/bridge';
import { useStepCounter } from '@/hooks/useStepCounter';
import { gpsReportDelay, gpsReportDelayAfterAttempt } from '@/services/gpsReport';
import { reportGps } from '@/services/gpsSender';
import { saveImageToGallery, type SaveImageResult } from '@/services/saveImageToGallery';
import { applyJudgeModePosition, useJudgeModeStore } from '@/store/judgeMode';
import { WEBVIEW_BOTTOM_INSET, webViewTopInset } from '@/styles/safeArea';
import { resolveMissionNavigateTarget } from '@/utils/missionNavigateTarget';
import { navigate } from '@/utils/navigate';
import { mapPermissionResponseToStatus } from './locationPermission';
import { reissueWebViewAuth } from './reissueWebViewAuth';

/**
 * 카드 이미지 저장 결과 안내.
 *
 * 저장은 앱이 하므로 결과도 앱이 알린다 — web은 브릿지로 보낸 뒤 성공했는지 알 방법이 없다.
 */
const SAVE_IMAGE_MESSAGE: Record<SaveImageResult, string> = {
  saved: '카드를 갤러리에 저장했어요',
  'permission-denied': '사진 저장 권한이 필요해요',
  failed: '카드를 저장하지 못했어요',
};

type LocationUpdatePayload = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
};

// web의 NAVIGATE.payload.route(케밥) ↔ /mission/intro의 mission 쿼리 파라미터 값 매핑
/**
 * Home WebView의 브릿지 로직(PING 응대, 위치 권한·구독, 걸음 수 전달, NAVIGATE)을 한데 묶는 훅.
 * HomeWebView.tsx는 이 훅이 반환하는 onMessage만 WebView에 꽂으면 된다.
 *
 * 전송 함수들을 전부 useCallback으로 감싼 이유는 의존성 안정화만이 아니다.
 * 렌더 스코프에 그대로 두면 Date.now() 호출과 ref 접근이 "렌더 중 실행"으로 취급돼
 * react-hooks/purity·refs 규칙에 걸린다. 실제로는 이벤트/이펙트에서만 호출된다.
 */
export function useHomeBridge(webViewRef: RefObject<WebView | null>) {
  const { steps, retry: retryStepPermission } = useStepCounter();
  const { show } = useToast();
  const insets = useSafeAreaInsets();
  const setJudgeMode = useJudgeModeStore((state) => state.setEnabled);

  /**
   * web에 넘길 상단 안전영역. **`insets.top`을 그대로 쓰면 안 된다.**
   *
   * Android에서 `insets.top`은 네이티브 뷰가 배치된 뒤에야 채워져 첫 렌더에는 0이다.
   * 주입 스크립트(HomeWebView.tsx)는 이미 `webViewTopInset`으로 그 0을 StatusBar.currentHeight로
   * 받쳐 첫 페인트를 맞춰 놓는데, 이 브릿지만 raw 0을 보내면 web이 첫 페인트 직후
   * (PING flush) 그 0으로 덮어써 **콘텐츠가 상태바 자리로 올라갔다가**, 뒤늦게 도착한 inset이
   * 다시 밀려오면 아래로 내려앉는다 — 사용자가 본 위아래 점프가 정확히 이것이다.
   *
   * 두 경로가 같은 함수를 거쳐야 값이 갈라지지 않는다(WEBVIEW_BOTTOM_INSET을 상수로 둔 것과 같은 이유).
   */
  const webTopInset = webViewTopInset(insets.top);

  // PING이 와서 storedTraceId가 확보되기 전까지 sendToWeb은 아무것도 보내지 않는다(bridge/utils.ts).
  // 그 사이 들어오는 위치/걸음 수를 흘리지 않도록 최신 값만 ref에 쌓아뒀다가 PING 시점에 한 번에 흘려보낸다.
  const latestLocationRef = useRef<LocationUpdatePayload | null>(null);
  // 권한 결과도 버퍼링한다. web은 Providers(부모)의 PING보다 HomePage(자식)의
  // LOCATION_PERMISSION_REQUEST를 먼저 보내는데(React는 자식 effect를 먼저 실행),
  // 이미 허용된 상태면 응답이 PING보다 빨리 나올 수 있어 그대로 두면 결과가 유실된다.
  const latestPermissionStatusRef = useRef<LocationPermissionStatus | null>(null);
  const latestStepsRef = useRef(0);
  const latestSafeAreaRef = useRef({ top: webTopInset, bottom: WEBVIEW_BOTTOM_INSET });
  const lastSentStepsRef = useRef<number | null>(null);
  const readyRef = useRef(false);
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const sendLocation = useCallback(
    (payload: LocationUpdatePayload) => {
      latestLocationRef.current = payload;
      if (!readyRef.current) return;
      sendToWeb(webViewRef, { type: 'LOCATION_UPDATE', payload });
    },
    [webViewRef],
  );

  const sendSteps = useCallback(
    (currentSteps: number) => {
      if (lastSentStepsRef.current === currentSteps) return;
      lastSentStepsRef.current = currentSteps;
      if (!readyRef.current) return;
      sendToWeb(webViewRef, {
        type: 'STEP_COUNT_UPDATE',
        payload: { steps: currentSteps, timestamp: Date.now() },
      });
    },
    [webViewRef],
  );

  // 안전영역은 네이티브만 알 수 있어서 app이 밀어줘야 한다.
  // 중복 전송을 막지 않는 이유: 같은 값을 여러 번 보내도 web은 같은 CSS 변수를 다시 쓸 뿐이고,
  // 이 기능의 실패 모드는 "덜 보내서 놓치는 것"이라 중복이 오히려 안전망이다.
  const sendSafeArea = useCallback(
    (next: { top: number; bottom: number }) => {
      latestSafeAreaRef.current = next;
      if (!readyRef.current) return;
      sendToWeb(webViewRef, { type: 'SAFE_AREA_UPDATE', payload: next });
    },
    [webViewRef],
  );

  const sendPermissionStatus = useCallback(
    (status: LocationPermissionStatus) => {
      latestPermissionStatusRef.current = status;
      if (!readyRef.current) return;
      sendToWeb(webViewRef, { type: 'LOCATION_PERMISSION_RESULT', payload: { status } });
    },
    [webViewRef],
  );

  // PING 도착 시 1회: ready 전환 + 그동안 쌓인 권한 결과/위치/걸음 수 flush
  const flushPending = useCallback(() => {
    readyRef.current = true;
    if (latestPermissionStatusRef.current) {
      sendToWeb(webViewRef, {
        type: 'LOCATION_PERMISSION_RESULT',
        payload: { status: latestPermissionStatusRef.current },
      });
    }
    if (latestLocationRef.current) {
      sendToWeb(webViewRef, { type: 'LOCATION_UPDATE', payload: latestLocationRef.current });
    }
    // steps는 0도 유효한 값이라 lastSentStepsRef를 null로 리셋해 강제로 재전송한다
    lastSentStepsRef.current = null;
    sendSteps(latestStepsRef.current);
    sendSafeArea(latestSafeAreaRef.current);
  }, [webViewRef, sendSteps, sendSafeArea]);

  // 걸음 수가 바뀔 때마다 web에 전달 — ready 이전이면 sendSteps 내부에서 무시되고,
  // 다음 flushPending(=다음 PING)에서 latestStepsRef의 최신값이 다시 흘러간다.
  useEffect(() => {
    latestStepsRef.current = steps;
    sendSteps(steps);
  }, [steps, sendSteps]);

  // 기기 네비게이션바 모드 변경·회전 등으로 inset이 바뀔 때.
  // bottom은 항상 0이다 — 루트 레이아웃이 네이티브에서 먹이므로 web이 더 띄우면 이중 여백이 된다.
  // top은 webTopInset(= 주입 스크립트와 같은 값)이라 첫 렌더에 이 이펙트가 먼저 돌아도
  // 주입해 둔 값을 0으로 되돌리지 않는다.
  useEffect(() => {
    sendSafeArea({ top: webTopInset, bottom: WEBVIEW_BOTTOM_INSET });
  }, [webTopInset, sendSafeArea]);

  // 다른 화면(미션 등)에 갔다 돌아올 때. 이때 WebView는 언마운트되지 않아 web이 PING을
  // 다시 보내지 않으므로, 화면이 다시 포커스되는 이 시점에 app이 먼저 밀어줘야 한다.
  useFocusEffect(
    useCallback(() => {
      sendSafeArea(latestSafeAreaRef.current);
    }, [sendSafeArea]),
  );

  /**
   * 지금 위치를 한 번 읽어 web(postMessage)과 서버에 흘려보낸다.
   *
   * 아래 구독은 `distanceInterval: 5`라 5m를 움직여야 콜백이 온다. 책상에 앉아 있으면 그 조건이
   * 영영 충족되지 않아, 이 밀어주기가 없으면 (1) 앱을 켠 직후 홈 상단 주소가
   * "위치를 확인할 수 없어요"에 머물고 (2) 심사위원용 모드를 토글해도 옛 기준이 남는다.
   *
   * `immediate`는 서버 전송에만 걸린다(gpsSender.ts) — 앱 시작·모드 토글처럼 **좌표의 의미가
   * 방금 바뀐** 호출은 간격을 건너뛰고, 아래 정기 타이머가 부르는 회차는 간격을 지킨다.
   *
   * 마지막으로 알려진 위치를 먼저 본다(실제 측위는 몇 초 걸린다). 둘 다 실패하면 구독이 이어받는다.
   */
  const pushCurrentLocation = useCallback(
    async (immediate: boolean) => {
      try {
        const position = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!position) return;

        // web에는 실측 좌표 그대로. 제주 고정은 web이 자기 쪽에서 한다(아래 구독과 같은 이유)
        sendLocation({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy ?? 0, timestamp: position.timestamp });

        // 서버에는 모드를 태운 좌표를 보낸다
        const reported = applyJudgeModePosition(position.coords);
        reportGps({ lat: reported.latitude, lng: reported.longitude }, { immediate });
      } catch {
        // 측위 실패는 구독이 이어받으므로 화면을 막을 이유가 아니다
      }
    },
    [sendLocation],
  );

  /**
   * 정기 GPS 저장 타이머.
   *
   * **스펙이 "앱 서비스를 시작하면 10분마다 저장"이라 반드시 타이머가 필요하다.** 예전에는 전송이
   * 위치 구독 콜백에만 매달려 있었는데, 그 구독은 `distanceInterval: 5`라 **가만히 있으면 콜백
   * 자체가 오지 않는다.** 숙소에 앉아 있는 동안에는 몇 시간이 지나도 POST가 한 번도 나가지 않아
   * 스펙의 주기가 지켜지지 않았다. 움직임과 무관하게 시간이 흐르는 것만으로 전송이 나가야 한다.
   *
   * setInterval이 아니라 **매번 다시 잡는 setTimeout**인 이유는 위상 때문이다. 앱 시작 직후의
   * 1회 전송이나 이동 콜백이 게이트 시각을 밀면 고정 위상 타이머는 몇 ms 차이로 회차를 통째로
   * 건너뛰어 실제 주기가 20분이 된다. 남은 시간을 게이트에서 매번 다시 물으면(gpsReportDelay)
   * 그 어긋남이 생기지 않고, 이동 콜백이 먼저 보내 간 경우도 저절로 보정된다.
   */
  const gpsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 타이머 콜백이 자기 자신을 다시 잡아야 하는데 useCallback끼리 서로를 참조할 수는 없다.
  // 최신 스케줄러를 ref로 건너뛴다(HomeWebView.tsx의 스크립트 ref와 같은 이유).
  const scheduleGpsReportRef = useRef<(delayMs: number) => void>(() => undefined);

  const scheduleGpsReport = useCallback(
    (delayMs: number) => {
      if (gpsTimerRef.current !== null) clearTimeout(gpsTimerRef.current);

      gpsTimerRef.current = setTimeout(() => {
        gpsTimerRef.current = null;

        // 이 회차를 기다리는 사이 이동 콜백이나 모드 토글이 먼저 보냈으면 아직 차례가 아니다.
        // 측위까지 갈 것 없이 남은 시간만큼 다시 잡는다 — 이래야 실제 간격이 10분으로 유지된다
        // (그냥 한 간격을 다시 세면 마지막 전송으로부터 15분이 벌어진다).
        const remaining = gpsReportDelay(Date.now());
        if (remaining > 0) {
          scheduleGpsReportRef.current(remaining);
          return;
        }

        // 다음 회차는 이번 시도가 **끝난 뒤에** 잡는다. 측위 전에 잡으면 게이트가 아직 열려 있어
        // 남은 시간이 0으로 나오고 타이머가 폭주한다.
        void (async () => {
          await pushCurrentLocation(false);
          scheduleGpsReportRef.current(gpsReportDelayAfterAttempt(Date.now()));
        })();
      }, delayMs);
    },
    [pushCurrentLocation],
  );

  useEffect(() => {
    scheduleGpsReportRef.current = scheduleGpsReport;
  }, [scheduleGpsReport]);

  const requestLocationPermission = useCallback(async () => {
    let response: Location.LocationPermissionResponse;
    try {
      response = await Location.requestForegroundPermissionsAsync();
    } catch (error) {
      sendToWeb(webViewRef, {
        type: 'LOCATION_ERROR',
        payload: { message: error instanceof Error ? error.message : String(error) },
      });
      return;
    }

    sendPermissionStatus(mapPermissionResponseToStatus(response));

    if (!response.granted) return;

    // 백그라운드 저장(services/gpsBackgroundTask.ts)에는 "항상 허용"이 **따로** 필요하다.
    // 포그라운드 권한과 별개의 요청이고, Android 11+에서는 시스템이 이 요청을 설정 화면으로
    // 넘긴다(같은 다이얼로그에서 한 번에 올려 줄 수 없게 막혀 있다).
    //
    // 결과를 보지 않고 실패도 삼키는 이유: 거절당해도 앱은 그대로 돌아가야 한다.
    // 포그라운드 타이머는 계속 10분 주기를 지키고 백그라운드 회차만 빠진다 —
    // 이 권한이 없다고 홈 화면의 위치 흐름까지 막으면 부가 기능이 주 기능을 망가뜨리는 꼴이다.
    void Location.requestBackgroundPermissionsAsync().catch(() => undefined);

    // 구독을 걸기 **전에** 지금 위치를 한 번 보낸다(pushCurrentLocation 주석 참고).
    // 스펙의 "앱 서비스를 시작하면 (…) 1회"가 이 전송이다 — 간격을 건너뛰고 바로 나간다.
    //
    // 그 뒤로는 타이머가 10분 주기를 지킨다. 권한이 있어야 측위가 되므로 여기가 주기의 시작점이다.
    // 타이머를 **첫 전송이 끝난 뒤에** 거는 게 중요하다 — 먼저 걸면 게이트가 아직 비어 있어
    // 남은 시간이 0으로 나오고, 시작 직후 측위가 두 번 돌면서 POST도 두 번 나갈 수 있다.
    // 재요청(web 재시도 등)으로 이 함수가 다시 불려도 scheduleGpsReport가 이전 타이머부터 정리한다.
    void (async () => {
      await pushCurrentLocation(true);
      scheduleGpsReport(gpsReportDelayAfterAttempt(Date.now()));
    })();

    // 재요청(web 재시도 등)으로 이미 구독 중이면 중복 구독을 만들지 않고 이전 것부터 정리한다.
    watchSubscriptionRef.current?.remove();
    try {
      watchSubscriptionRef.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 3000, distanceInterval: 5 }, (location) => {
        // web에는 **실측 좌표 그대로**. 제주 고정은 web이 자기 쪽에서 한다(entities/location) —
        // 여기서 미리 바꾸면 web 스토어에 실제 위치가 없어 모드를 끄는 순간 주소가 제주에 머문다.
        sendLocation({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: location.coords.accuracy ?? 0,
          timestamp: location.timestamp,
        });

        // **여기서는 서버로 보내지 않는다.** 정기 저장은 위 타이머 하나가 책임진다.
        //
        // 예전에는 이 콜백도 reportGps를 불렀다. 게이트가 모듈 스코프라 요청이 늘지는 않았지만,
        // 어느 쪽이 게이트를 먼저 채우느냐로 **보내는 좌표의 성격이 갈렸다.** 이 구독은
        // `distanceInterval: 5`라 5m를 움직여야 콜백이 오므로, 여기서 채운 회차는 언제나
        // "이동 중인 좌표"다. 그런데 이 엔드포인트는 좌표만 쌓는 게 아니라 **방문 장소를
        // 판정한다**(gpsReport.ts) — 판정이 원하는 건 관광지에 **머문** 좌표이지 지나가는 좌표가
        // 아니다. 9:50에 도착해 10:30에 떠나는 사람이라면 타이머는 10:00에 그 장소를 남기고,
        // 이 콜백은 10:30에 이미 떠나는 좌표를 남긴다. 덤이 아니라 오히려 나쁜 회차였다.
        //
        // 이 구독이 계속 필요한 이유는 위의 sendLocation이다 — web으로 가는 유일한 실시간 좌표
        // 공급원이라 지도 마커·상단 주소·미션 근접 판정이 전부 여기에 매달려 있다.
      });
    } catch (error) {
      sendToWeb(webViewRef, {
        type: 'LOCATION_ERROR',
        payload: { message: error instanceof Error ? error.message : String(error) },
      });
    }
  }, [webViewRef, sendLocation, sendPermissionStatus, pushCurrentLocation, scheduleGpsReport]);

  useEffect(() => {
    return () => {
      watchSubscriptionRef.current?.remove();
      if (gpsTimerRef.current !== null) clearTimeout(gpsTimerRef.current);
    };
  }, []);

  /**
   * 백그라운드에 있다 돌아왔을 때 밀린 회차를 즉시 따라잡는다.
   *
   * JS 타이머는 앱이 백그라운드로 내려가면 (특히 안드로이드 Doze에서) 제때 깨지 않는다.
   * 20분 뒤에 돌아왔는데 남은 타이머가 그대로 흘러가면 그만큼 더 늦게 전송된다.
   * 복귀 시점에 다시 잡으면 게이트가 이미 지났으므로 남은 시간이 0으로 나와 바로 나간다.
   *
   * 타이머가 아직 없는 상태(위치 권한 전)에서는 아무것도 잡지 않는다 — 측위가 안 되므로
   * 빈 회차만 돌게 된다. 시작은 권한 허용 시점의 requestLocationPermission이 맡는다.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (gpsTimerRef.current === null) return;
      // 여기서는 남은 시간을 그대로 쓴다 — 회차가 밀렸으면 0이 나와 즉시 따라잡는다.
      scheduleGpsReport(gpsReportDelay(Date.now()));
    });
    return () => subscription.remove();
  }, [scheduleGpsReport]);

  // listenFromWeb 호출까지 콜백 안으로 넣는다. 렌더 중에 부르면 ref를 넘기는 셈이 돼
  // react-hooks/refs가 잡는다 — 실제 파싱·검증은 메시지가 도착한 시점에만 일어난다.
  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      listenFromWeb((msg) => {
        switch (msg.type) {
          case 'PING':
            initTraceId(msg.traceId);
            sendToWeb(webViewRef, { type: 'PONG', payload: { timestamp: Date.now() } });
            flushPending();
            return;
          case 'LOCATION_PERMISSION_REQUEST':
            void requestLocationPermission();
            return;
          case 'AUTH_TOKEN_REQUEST':
            // web이 401을 만났다. 새 토큰을 발급해 페이지에 다시 심어 준다(reissueWebViewAuth 주석).
            void reissueWebViewAuth(webViewRef);
            return;
          case 'JUDGE_MODE_UPDATE':
            // 모드의 주인은 web이다(홈 하단 메뉴 아이콘 3초 꾹 + localStorage). 앱은 받은 값을
            // 메모리에만 들고 협동 미션 시뮬레이션·네이티브 좌표에 쓴다(store/judgeMode.ts).
            setJudgeMode(msg.payload.enabled);
            // 토글 즉시 새 기준으로 좌표를 다시 흘려보낸다. 스토어를 먼저 바꾼 뒤라
            // 서버로 나가는 값이 새 모드를 탄다(zustand set은 동기라 여기서 이미 반영돼 있다).
            // 간격을 건너뛰므로(immediate) 정기 회차의 위상도 이 시점부터 다시 센다.
            void pushCurrentLocation(true);
            return;
          case 'STEP_PERMISSION_REQUEST':
            // 홈에서 거절당한 신체 활동 권한을 마이페이지에서 한 번 더 묻는다.
            // 허용되면 useStepCounter가 센서를 켜고 미전송 걸음 수를 저장한다.
            void retryStepPermission();
            return;
          case 'NAVIGATE': {
            // web의 "시작하기"를 연타하면 NAVIGATE가 두 번 날아온다.
            // 연타 차단은 navigate가 전역으로 들고 있어서 여기서 따로 세지 않는다.
            //
            // missionId는 옛 web 빌드에서 안 올 수 있다. 그때는 파라미터를 넣지 않고
            // intro가 기본 id로 진행한다(constants/missionHome.ts).
            //
            // resume이면 인트로를 건너뛰고 진행 화면으로 간다 — 홈 상단 "진행중인 미션" 카드다.
            const target = resolveMissionNavigateTarget(msg.payload.route, msg.payload.resume);
            navigate.push({
              pathname: target.pathname,
              params: {
                ...(target.mission === undefined ? {} : { mission: target.mission }),
                ...(msg.payload.missionId === undefined ? {} : { missionId: String(msg.payload.missionId) }),
              },
            });
            return;
          }
          case 'SAVE_IMAGE':
            // 도감 카드의 저장 버튼. 카드 그림은 web만 만들 수 있고 갤러리 쓰기는 네이티브만 할 수 있다.
            // 결과는 앱이 토스트로 알린다 — web은 저장이 끝났는지 알 방법이 없다.
            void (async () => {
              const result = await saveImageToGallery(msg.payload.dataUrl, msg.payload.fileName);
              // 이 화면 아래에는 web이 그린 "함께 사진 찍기"가 깔려 있다 — 그 위로 띄운다(사용자 지시)
              show(SAVE_IMAGE_MESSAGE[result], { bottomClearance: TOAST_WEBVIEW_CTA_CLEARANCE });
            })();
            return;
          case 'CHARACTER_PHOTO':
            // 마이페이지 도감의 "함께 사진 찍기". 카메라는 네이티브만 열 수 있어서 web이 부탁한다.
            // 무엇을 찍을지(캐릭터 이름·그림)는 web이 함께 보내 준다 — 앱에는 도감 데이터가 없다.
            navigate.push({
              pathname: '/character-photo',
              params: { characterId: msg.payload.characterId, name: msg.payload.name, imageUrl: msg.payload.imageUrl },
            });
            return;
        }
      })(event);
    },
    [webViewRef, flushPending, requestLocationPermission, retryStepPermission, show, setJudgeMode, pushCurrentLocation],
  );

  return { onMessage };
}
