import * as BackgroundTask from 'expo-background-task';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { applyJudgeModePosition, isJudgeModeEnabled } from '@/store/judgeMode';
import { hasUsableAuthorization, hydrateSessionCache } from './auth';
import { GPS_REPORT_INTERVAL_MINUTES } from './gpsReport';
import { reportGpsAsync } from './gpsSender';

/**
 * 앱이 백그라운드에 있어도 좌표를 계속 저장하는 태스크.
 *
 * 기제는 걸음 수 동기화(services/backgroundTask.ts)와 **같은 것을 그대로 쓴다** —
 * expo-task-manager로 태스크를 정의하고 expo-background-task로 등록한다.
 * 새 기제를 들이지 않은 이유는 하나 더 늘리면 "이건 왜 저쪽이 아니라 이쪽인가"를 매번
 * 설명해야 하고, 백그라운드 실행은 OS별 함정이 많아 한 군데로 모아 두는 편이 낫기 때문이다.
 *
 * 다만 걸음 수와 결정적으로 다른 점이 하나 있다.
 * 걸음 수 태스크는 **이미 SQLite에 쌓여 있는 것**을 보내기만 해서 센서를 건드리지 않는다.
 * GPS는 그 자리에서 **측위를 해야** 한다. 그래서 백그라운드 위치 권한이 따로 필요하다
 * (Android ACCESS_BACKGROUND_LOCATION / iOS "항상 허용"). 그 권한이 없으면 이 태스크는
 * 깨어나긴 해도 좌표를 못 얻고 빈손으로 돌아간다 — 조용히 실패하는 쪽이라 특히 조심할 것.
 *
 * **주기는 OS가 정한다. 10분은 요청이지 보장이 아니다.**
 * - Android: WorkManager의 주기 작업 최소값이 15분이라 10분을 넣어도 15분으로 올라간다.
 *   Doze 상태면 그보다 더 벌어진다.
 * - iOS: BGTaskScheduler는 "짧은 간격은 대체로 무시하고 시스템이 정한 창에서 돌린다"고
 *   문서가 명시한다(expo-background-task의 minimumInterval 주석). 몇 시간에 한 번일 수 있다.
 *
 * 즉 포그라운드에서만 정확히 10분이고, 백그라운드는 "가능한 한 자주"가 정직한 표현이다.
 * 진짜로 백그라운드에서 10분을 지키려면 Location.startLocationUpdatesAsync + Android
 * 포그라운드 서비스(상단에 상시 알림이 뜬다)로 가야 하는데, 그건 사용자에게 보이는 변화라
 * 여기서 임의로 정하지 않았다.
 */

const GPS_REPORT_TASK = 'GPS_REPORT_TASK';

// 전역 스코프에서 태스크 정의 (앱 로드 시 즉시 실행).
// OS가 백그라운드에서 앱을 깨울 때는 화면이 하나도 뜨지 않으므로, 태스크 정의가 화면 모듈에
// 딸려 있으면 "등록된 적 없는 태스크"가 되어 실행이 통째로 버려진다.
// 그래서 _layout.tsx가 이 모듈을 import한다 — backgroundTask.ts와 같은 방식이다.
TaskManager.defineTask(GPS_REPORT_TASK, async () => {
  try {
    // **측위보다 먼저 토큰을 확인한다.** 헤드리스 기동에는 React 트리가 없어
    // useAppBootstrap → bootstrapSession이 돌지 않고, 세션 캐시를 채우는 곳은 그 부트스트랩
    // 뿐이다. 그래서 예전에는 sqlite에 멀쩡한 토큰이 있는데도 이 회차의 POST가 Authorization
    // 없이 나가 401로 조용히 버려졌다 — 10분마다 반복되는데 로그 한 줄 남지 않는 종류다.
    // hydrateSessionCache는 저장된 세션을 캐시로 올리기만 한다(발급하지 않는다 — auth.ts 주석).
    await hydrateSessionCache();

    // 심사위원용 모드가 켜져 있으면 앱 토큰이 없어도 심사위원 토큰이 붙는다(authHeader.ts).
    // 다만 그 모드는 메모리 전용이고 주인이 web이라(store/judgeMode.ts) OS가 프로세스를 새로
    // 띄운 **헤드리스 회차에서는 언제나 false**다 — 즉 그 경우 필요한 것은 앱 토큰이다.
    // 프로세스가 살아 있는 채로 태스크만 깨는 경우에만 이 갈래가 true가 될 수 있다.
    //
    // 붙일 헤더가 없으면 여기서 끝낸다. 측위(배터리)와 실패할 게 뻔한 POST를 둘 다 아낀다.
    // Success로 돌려주는 이유는 아래 position 분기와 같다 — 태스크가 실패한 게 아니라
    // 이번 회차에 보낼 것이 없는 것이다. 다음 포그라운드 실행이 부트스트랩으로 풀어 준다.
    // (게이트는 건드리지 않는다 — reportGpsAsync를 부르지 않았으니 다음 회차가 그대로 온다.)
    if (!hasUsableAuthorization(isJudgeModeEnabled())) return BackgroundTask.BackgroundTaskResult.Success;

    // 마지막으로 알려진 위치를 먼저 본다. 백그라운드에서 새 측위를 돌리면 몇 초씩 걸리고
    // 그만큼 배터리를 쓰는데, 10분 주기의 방문 기록에는 캐시된 좌표로도 충분하다.
    // 캐시가 비었을 때만 실제 측위로 넘어간다(useHomeBridge의 1회 측위와 같은 순서).
    const position = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));

    // 권한이 없거나 위치 서비스가 꺼져 있으면 여기로 온다. 이건 태스크의 실패가 아니라
    // "이번엔 보낼 게 없다"이다 — Failed로 돌려주면 OS가 이 태스크를 점점 덜 깨운다.
    if (!position) return BackgroundTask.BackgroundTaskResult.Success;

    // 심사위원용 모드는 메모리에만 있다(store/judgeMode.ts). 앱이 완전히 종료된 뒤 OS가
    // 프로세스를 새로 띄운 경우에는 기본값 false라 실측 좌표가 그대로 나간다.
    // 모드의 주인이 web이라 앱 혼자서는 복원할 방법이 없고, 그때는 홈이 열리는 순간
    // JUDGE_MODE_UPDATE가 다시 와서 맞춰진다.
    const reported = applyJudgeModePosition(position.coords);

    // 여기서는 **반드시 기다린다**(reportGpsAsync). 던져 놓고 반환하면 OS가 프로세스를
    // 재우면서 요청이 잘린다. 게이트가 막아 아무것도 안 보낸 회차도 정상이다 —
    // 포그라운드 타이머가 방금 보냈다는 뜻이다.
    await reportGpsAsync({ lat: reported.latitude, lng: reported.longitude });

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.warn('[BackgroundTask] GPS_REPORT_TASK 실패:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** 백그라운드 태스크를 등록한다. _layout.tsx에서 호출 */
export async function registerGpsReportTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(GPS_REPORT_TASK);
  if (isRegistered) return;

  await BackgroundTask.registerTaskAsync(GPS_REPORT_TASK, {
    // 분 단위다(위 상수 주석 참고). Android는 이 값을 15분으로 올려 잡는다.
    minimumInterval: GPS_REPORT_INTERVAL_MINUTES,
  });
}
