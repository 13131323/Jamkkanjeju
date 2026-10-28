import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { hasUsableAuthorization, hydrateSessionCache } from '@/services/auth';
import { sendStepRecord } from '@/services/stepCountSender';
import { isJudgeModeEnabled } from '@/store/judgeMode';
import { syncUnsentRecords } from './stepSyncService';

const STEP_SYNC_TASK = 'STEP_SYNC_TASK';

// 전역 스코프에서 태스크 정의 (앱 로드 시 즉시 실행)
TaskManager.defineTask(STEP_SYNC_TASK, async () => {
  try {
    // GPS 태스크(gpsBackgroundTask.ts)와 **같은 구멍을 같은 방법으로 막는다.**
    // 헤드리스 기동에는 React 트리가 없어 useAppBootstrap → bootstrapSession이 돌지 않고,
    // 세션 캐시를 채우는 곳은 그 부트스트랩뿐이라 PUT이 Authorization 없이 나갔다.
    // 저장된 세션을 캐시로 올리기만 한다 — 발급하지 않는다(auth.ts 주석).
    await hydrateSessionCache();

    // 붙일 헤더가 없으면 아예 시작하지 않는다. 걸음 수는 GPS와 달리 실패해도 잃는 게 없지만
    // (syncUnsentRecords가 실패한 레코드를 synced=0으로 남겨 다음 회차에 재시도한다),
    // 그래도 깨어난 회차마다 401 왕복과 경고 로그를 쌓을 이유가 없다.
    // Failed가 아니라 Success인 이유는 GPS 태스크와 같다 — 태스크의 실패가 아니라
    // 이번 회차에 보낼 것이 없는 것이고, Failed로 돌려주면 OS가 점점 덜 깨운다.
    if (!hasUsableAuthorization(isJudgeModeEnabled())) return BackgroundTask.BackgroundTaskResult.Success;

    await syncUnsentRecords(sendStepRecord);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.warn('[BackgroundTask] STEP_SYNC_TASK 실패:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** 백그라운드 태스크를 등록한다. _layout.tsx에서 호출 */
export async function registerStepSyncTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(STEP_SYNC_TASK);
  if (isRegistered) return;

  await BackgroundTask.registerTaskAsync(STEP_SYNC_TASK, {
    // **초가 아니라 분 단위다.** expo-background-task의 타입 주석이 "Inexact interval in
    // minutes"이고, iOS는 didRegisterTask(minutes:)에서 `Double(minutes) * 60`으로,
    // Android는 repeatIntervalTimeUnit = TimeUnit.MINUTES로 받는다.
    // 예전 값 `15 * 60`은 초로 착각해 곱한 것이라 900분 = **15시간**으로 등록됐다.
    // 에러가 나지 않고 "태스크가 안 깬다"로만 드러나는 종류라 오래 남아 있었다.
    minimumInterval: 15,
  });
}
