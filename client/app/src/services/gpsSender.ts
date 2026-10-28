import { saveGpsApiV1UsersMeGpsPost } from '@/services/api/others/others';
import { acceptGpsReport, toGpsSaveRequest } from './gpsReport';

/**
 * 사용자 좌표를 서버에 저장하는 sender.
 *
 * 훅이 아닌 평범한 함수(orval의 plain 함수)를 쓰는 이유는 stepCountSender와 같다:
 * 호출부가 watchPositionAsync 콜백 안이라 React 트리 밖이고, 훅 규칙을 지킬 수 없다.
 *
 * 간격 판정과 요청 바디 변환은 gpsReport.ts에 있다 — 이 파일은 생성 API를 import해서
 * vitest로 불러올 수 없으므로, 검증할 값이 있는 로직은 전부 그쪽에 둔다.
 */

/**
 * 좌표를 서버에 저장한다. 간격이 안 찼으면 아무것도 하지 않는다.
 *
 * **절대 던지지 않고 아무것도 기다리게 하지 않는다.** 호출부는 useHomeBridge의
 * pushCurrentLocation이고, 그 안에서 web으로 LOCATION_UPDATE를 보낸 **직후**에 불린다.
 * GPS 저장이 실패하거나 느리다고 지도·미션이 쓰는 web 좌표 흐름이 끊기거나 밀리면 안 된다 —
 * 부가 기능의 실패가 주 기능을 망가뜨리는 쪽이 훨씬 나쁜 실패다.
 *
 * (기다려야 하는 호출부는 백그라운드 태스크 하나뿐이고, 그쪽은 아래 reportGpsAsync를 쓴다.)
 *
 * 조용히 삼키는 실패에는 토큰이 아직 없을 때의 401도 포함된다. 세션 부트스트랩이 끝나기 전에
 * 좌표가 먼저 흐를 수 있다 — 재시도할 일이 아니라 다음 좌표에서 저절로 풀리는 상태다.
 *
 * **백그라운드 태스크는 더 이상 이 경로로 오지 않는다.** 예전에는 헤드리스 실행에 부트스트랩이
 * 돌지 않아 캐시가 빈 채로 POST가 나갔고, 그 401을 여기서 삼키는 바람에 10분마다 조용히
 * 실패하는 상태가 드러나지 않았다. 지금은 gpsBackgroundTask.ts가 전송 전에
 * `hydrateSessionCache`로 sqlite의 세션을 올리고, 그래도 토큰이 없으면 **아예 부르지 않는다**.
 *
 * **그 401이 앱의 신원을 지우지는 않는다.** client.ts의 401 인터셉터는 거절당한 것이 앱 토큰일
 * 때만 세션을 버린다(services/authHeader.ts). 예전에는 401이면 무조건 버려서, 토큰 없이 나간
 * 이 요청 하나가 sqlite의 Session 행까지 지우고 다음 실행을 새 사용자로 만들 수 있었다.
 */
export function reportGps(coords: { lat: number; lng: number }, options?: { immediate?: boolean }): void {
  void reportGpsAsync(coords, options);
}

/**
 * 같은 전송을 **끝날 때까지 기다리는** 형태. 백그라운드 태스크(gpsBackgroundTask.ts)가 쓴다.
 *
 * 포그라운드에서는 기다리지 않는 게 맞지만 백그라운드에서는 정반대다. 태스크 콜백이 반환하는
 * 순간 OS는 "할 일이 끝났다"고 보고 프로세스를 재우기 때문에, fire-and-forget으로 던지면
 * 요청이 나가기도 전에 잘린다. 그래서 여기서만 await한다.
 *
 * 반환값은 "게이트를 통과해 실제로 요청을 냈는가"다. 전송의 성공 여부가 아니다 —
 * 실패는 아래 sendGps가 그대로 삼킨다.
 */
export async function reportGpsAsync(coords: { lat: number; lng: number }, options?: { immediate?: boolean }): Promise<boolean> {
  const now = Date.now();

  // 응답이 아니라 **시도 시점**에 게이트를 닫는다. 성공했을 때만 닫으면 10분 동안 오는
  // 콜백 수백 번이 전부 통과해 요청이 겹겹이 날아간다. 실패한 회차는 버린다 —
  // 위치는 10분 뒤 값이 어차피 더 정확해서 재시도할 가치가 없다.
  //
  // `immediate`는 그 간격을 한 번 건너뛴다. 앱을 켠 직후나 심사위원용 모드를 토글한 직후처럼
  // **좌표의 의미가 방금 바뀐** 순간에는 10분을 기다릴 이유가 없다 — 기다리면 그동안 서버에
  // 남는 기록이 화면이 보여 주는 위치와 어긋난다. 간격 0으로 통과시키되 시각은 그대로
  // 기록하므로, 다음 정기 전송은 이 시점부터 다시 10분을 센다.
  //
  // 이 게이트가 포그라운드 타이머와 백그라운드 태스크를 겹치지 않게 하는 장치이기도 하다.
  // 둘은 서로를 모르지만 같은 모듈 상태를 보므로, 방금 보낸 회차를 뒤따라온 쪽이 다시 보내지 않는다.
  if (!acceptGpsReport(now, options?.immediate ? 0 : undefined)) return false;

  // 요청 시각은 게이트에 쓴 것과 같은 now로 만든다. Date.now()를 한 번 더 부르면
  // 기록 시각과 recordedAt이 미세하게 어긋난다.
  await sendGps(coords, new Date(now));
  return true;
}

/** 204라 응답 본문이 없다 — 반환값을 쓰지 않는다 */
async function sendGps(coords: { lat: number; lng: number }, at: Date): Promise<void> {
  try {
    await saveGpsApiV1UsersMeGpsPost(toGpsSaveRequest(coords, at));
  } catch (error) {
    // 운영에서는 흘린다. 다음 회차가 10분 뒤에 또 오므로 실패가 이어지면 로그만 도배되고,
    // 사용자가 할 수 있는 조치도 없다.
    if (__DEV__) console.warn('[gps] 좌표 저장 실패:', error);
  }
}
