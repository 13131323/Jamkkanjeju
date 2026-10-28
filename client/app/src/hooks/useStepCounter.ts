import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { PermissionsAndroid } from 'react-native';
import { isStepCountingSupported } from 'react-native-step-counter-newarch';
import { msUntilNextKstMidnight } from '@/services/kstDayBoundary';
import { startCounting, stopCounting, getTodaySteps } from '@/services/stepCounterService';
import { sendStepRecord } from '@/services/stepCountSender';
import { syncUnsentRecords } from '@/services/stepSyncService';

export type StepCounterStatus = 'loading' | 'unsupported' | 'denied' | 'active';

export function useStepCounter() {
  const [steps, setSteps] = useState(0);
  const [status, setStatus] = useState<StepCounterStatus>('loading');
  const appState = useRef(AppState.currentState);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return false;
    if (Number(Platform.Version) < 29) return true;

    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION, {
      title: '걸음 수 권한',
      message: '걸음 수를 측정하려면 활동 인식 권한이 필요합니다.',
      buttonPositive: '허용',
      buttonNegative: '거부',
    });
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  const start = useCallback(async () => {
    setSteps(await getTodaySteps());
    startCounting((currentSteps) => {
      setSteps(currentSteps);
    });
    setStatus('active');
  }, []);

  const initialize = useCallback(async () => {
    const { supported } = await isStepCountingSupported();
    if (!supported) {
      setStatus('unsupported');
      return;
    }

    const granted = await requestPermission();
    if (!granted) {
      setStatus('denied');
      return;
    }

    await start();

    // 신체 활동 권한을 허용받은 시점부터 걸음 수 저장이 가능하다(PUT /api/v1/users/me/step-counts).
    // 이 권한이 없으면 셀 수도 없어 저장할 레코드 자체가 생기지 않는다.
    // 화면에 보여주는 값은 그대로 두고 저장만 한다. await하지 않아 센서 시작이 밀리지 않는다.
    void syncUnsentRecords(sendStepRecord);
  }, [requestPermission, start]);

  /**
   * KST 자정에 화면 값을 0으로 되돌리고 전날 걸음 수를 전송한다.
   *
   * 걸음 수는 **일일** 값이다. 저장은 이미 날짜별 행으로 나뉘어 있어서(DailySteps) 자정을 넘기면
   * 새 행이 0부터 쌓이지만, **화면 값은 센서 콜백으로만 갱신**된다 — 자정에 걷지 않으면 어제
   * 숫자가 그대로 남아 있다. 그래서 경계 시점에 직접 다시 읽는다(새 날의 값이라 0이다).
   *
   * 같은 시점에 동기화도 돌린다. syncUnsentRecords는 어제 이전 날짜만 보내므로, 자정을 넘긴
   * 직후가 전날 총계를 보낼 수 있게 되는 첫 순간이다. 서버는 날짜별로 값을 덮어쓰므로
   * (PUT /api/v1/users/me/step-counts) 전날 행은 이 전송으로 확정된다.
   *
   * 앱을 백그라운드로 두면 타이머가 늦게 깨거나 아예 안 깰 수 있다. 그 경우는 아래 포그라운드
   * 복귀 처리가 같은 일을 하므로 두 경로가 서로를 받친다.
   */
  useEffect(() => {
    if (status !== 'active') return;

    let timer: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      timer = setTimeout(() => {
        void (async () => {
          setSteps(await getTodaySteps());
          void syncUnsentRecords(sendStepRecord);
        })();
        scheduleNext();
      }, msUntilNextKstMidnight());
    };

    scheduleNext();
    return () => clearTimeout(timer);
  }, [status]);

  // 앱 포그라운드 복귀 시 센서 재시작 + 동기화
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (status === 'active') {
          void start();
        }
        // 포그라운드 복귀 시 미전송 레코드 동기화 (fallback)
        void syncUnsentRecords(sendStepRecord);
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [status, start]);

  // 초기 실행
  useEffect(() => {
    // initialize updates state only after native support and permission Promises settle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void initialize();
    return () => stopCounting();
  }, [initialize]);

  /** 권한 거부 후 재요청 */
  const retry = useCallback(async () => {
    setStatus('loading');
    await initialize();
  }, [initialize]);

  return { steps, status, retry };
}
