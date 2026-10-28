import type { GeneratedApi } from '@packages/shared';
import { toKstTimestamp } from '@/utils/kstTimestamp';

/**
 * GPS 서버 저장의 "지금 보낼 차례인가" 판정과 요청 바디 변환.
 *
 * 전송(gpsSender)과 따로 둔 이유는 stepCountRequest.ts와 같다: sender는 생성된 API를
 * import하고 그 체인이 axios → react-native까지 이어져서, vitest(플레인 node, Metro 트랜스폼
 * 없음)에서 import하는 순간 react-native의 Flow 구문을 파싱하지 못해 죽는다.
 * 이 파일의 런타임 import는 kstTimestamp(순수 TS)뿐이라 테스트에서 그대로 불러올 수 있다.
 */

/**
 * 서버에 좌표를 저장하는 간격(ms).
 *
 * **스펙이 정한 값이다**: "앱 서비스를 시작하면 10분마다 POST /api/v1/users/me/gps".
 * 앱 실행 직후 1회(useHomeBridge의 pushCurrentLocation), 그 뒤로 10분마다다.
 *
 * 이 값이 "상한"이 아니라 **실제 주기**인 이유:
 * 예전에는 전송이 watchPositionAsync 콜백에만 매달려 있었는데, 그 구독은 `distanceInterval: 5`라
 * **가만히 있으면 콜백 자체가 오지 않는다.** 책상에 앉아 있는 동안에는 10분이 지나도 아무것도
 * 안 나갔고, 이 상수는 "움직이는 동안의 상한"으로만 동작했다.
 * 지금은 useHomeBridge가 이 간격으로 타이머를 걸고 **그 타이머만이** 정기 전송을 책임진다
 * (그래서 아래 nextGpsReportDelay가 필요하다 — 타이머가 다음 회차를 잡을 때 쓴다).
 * 구독 콜백은 web으로 좌표를 흘리는 일만 하고 서버 저장에는 관여하지 않는다 — 그쪽이 채운
 * 회차는 언제나 "이동 중인 좌표"라 방문 장소 판정에는 오히려 불리했다(useHomeBridge 주석).
 *
 * 트레이드오프를 숨기지 않자면: 이 엔드포인트는 좌표만 쌓는 게 아니라 **방문 장소를
 * 판정한다**("GPS 및 방문 장소 저장"). 걷는 속도 1.3m/s 기준 10분은 약 780m라 좌표 밀도로
 * 방문을 짚기에는 성기다 — 관광지 한 곳을 통째로 건너뛴 채 앞뒤 좌표만 남을 수 있다.
 * 그 판정은 서버 몫이고, 더 촘촘한 궤적이 필요하다면 그건 이 상수를 몰래 줄일 일이 아니라
 * 스펙을 다시 정할 일이다. 반대로 트래픽·배터리 쪽은 시간당 6회라 부담이 없다.
 */
export const GPS_REPORT_INTERVAL_MS = 600_000;

/**
 * 같은 간격을 **분**으로 옮긴 값. 백그라운드 태스크 등록에만 쓴다.
 *
 * expo-background-task의 `minimumInterval`은 **단위가 분이다**(iOS 구현이
 * `didRegisterTask(minutes:)`로 받는다). 초로 착각해 `10 * 60`을 넣으면 600분,
 * 즉 10시간에 한 번이 되는데 **아무 에러도 나지 않고** 그냥 태스크가 안 깨는 것처럼 보인다.
 * 걸음 수 쪽(services/backgroundTask.ts)이 실제로 `15 * 60`으로 이 함정에 빠져 900분,
 * 즉 15시간에 한 번으로 등록돼 있었다(2026-09-10에 15로 수정). 그래서 이 파일은 분 단위
 * 상수를 따로 두고 테스트로 못박는다 — 곱셈 하나가 조용히 기능을 죽이는 자리다.
 *
 * ms 상수에서 계산해 두는 이유가 그것이다 — 주기를 바꿀 때 두 값이 갈라지지 않고,
 * 아래 테스트가 단위를 못박는다.
 */
export const GPS_REPORT_INTERVAL_MINUTES = GPS_REPORT_INTERVAL_MS / 60_000;

/**
 * 마지막으로 서버에 보낸 시각.
 *
 * 모듈 스코프인 게 핵심이다(navigationGate.ts와 같은 이유). 홈 화면 컴포넌트의 ref로 두면
 * 미션 화면을 오가며 언마운트·재마운트될 때 null로 돌아가서, 돌아올 때마다 간격을 무시한
 * 전송이 한 번씩 더 나간다. 간격은 화면 수명이 아니라 앱 실행 수명을 따라야 한다.
 */
let lastReportedAt: number | null = null;

/** 마지막 전송 시각과 지금을 비교해 보낼 차례인지 */
export function shouldReportGps(lastSentAt: number | null, now: number, intervalMs: number): boolean {
  // 한 번도 안 보냈으면 비교할 기준이 없다 — 첫 좌표는 바로 올려야 방문 기록이 앱 실행 직후부터 남는다
  if (lastSentAt === null) return true;

  return now - lastSentAt >= intervalMs;
}

/**
 * 전송을 통과시킬지 판정하고, 통과시키면 시각을 기록한다.
 *
 * navigationGate.acceptNavigation과 같은 이유로 판정과 기록을 한 함수에 묶었다 —
 * 호출부가 기록을 빠뜨리면 게이트가 조용히 무력해지고 3초마다 POST가 나간다.
 */
export function acceptGpsReport(now: number, intervalMs: number = GPS_REPORT_INTERVAL_MS): boolean {
  if (!shouldReportGps(lastReportedAt, now, intervalMs)) return false;

  lastReportedAt = now;
  return true;
}

/**
 * 다음 전송까지 남은 시간(ms). 지금이 이미 차례면 0.
 *
 * shouldReportGps의 "보낼 차례인가"를 시간으로 답하는 형태다. 정기 전송 타이머가
 * **고정 위상(setInterval)이 아니라 마지막 전송 시각 기준**으로 다음 회차를 잡으려면
 * 불리언이 아니라 남은 시간이 필요하다.
 *
 * 왜 고정 위상이면 안 되는가: 앱 시작 직후의 1회 전송(immediate)이 게이트 시각을 t≈0으로
 * 찍는데, 그와 무관하게 걸린 타이머가 t=간격에 깨면 경과가 간격보다 몇 ms 모자라서
 * acceptGpsReport가 그 회차를 **통째로 막는다**. 그러면 실제 전송은 20분마다가 된다.
 * 남은 시간을 매번 다시 계산하면 그 어긋남이 애초에 생기지 않는다.
 *
 * 시계가 뒤로 갔을 때(now < lastSentAt) 남은 시간이 간격보다 커지지만 그대로 둔다 —
 * 그 상황에서 shouldReportGps도 막는 쪽을 택했고(폭주 방지), 두 함수가 갈리면 안 된다.
 */
export function nextGpsReportDelay(lastSentAt: number | null, now: number, intervalMs: number): number {
  // 한 번도 안 보냈으면 기다릴 이유가 없다 — shouldReportGps가 true를 주는 것과 같은 판단이다
  if (lastSentAt === null) return 0;

  return Math.max(0, lastSentAt + intervalMs - now);
}

/**
 * 모듈 스코프 게이트를 기준으로 다음 전송까지 남은 시간(ms).
 *
 * 타이머(useHomeBridge)가 쓰는 입구다. 게이트를 직접 노출하지 않는 이유는 acceptGpsReport와
 * 같다 — 호출부가 마지막 전송 시각을 들고 다니기 시작하면 판정 기준이 두 벌이 된다.
 * 이동 콜백이 타이머보다 먼저 보내 간 경우에도 이 값만 다시 물으면 남은 시간이 저절로 맞는다.
 */
export function gpsReportDelay(now: number, intervalMs: number = GPS_REPORT_INTERVAL_MS): number {
  return nextGpsReportDelay(lastReportedAt, now, intervalMs);
}

/**
 * 측위를 한 번 시도한 **뒤** 다음 회차까지 기다릴 시간(ms).
 *
 * 시도가 전송으로 이어졌으면 게이트가 방금 닫혔으니 꼬박 한 간격이 남는다.
 * 여기서 0이 나온다면 **시도했는데 아무것도 못 보냈다**는 뜻이다 — 권한은 있어도 위치
 * 서비스가 꺼져 있어 측위가 계속 실패하는 경우가 그렇다.
 *
 * 그때 0을 그대로 타이머에 넘기면 회차가 꼬리를 물며 측위를 쉼 없이 재시도해 배터리를 태운다.
 * 실패한 회차는 버리고 다음 회차에서 다시 해 본다 — gpsSender가 전송 실패를 다루는 방식과 같다.
 * gpsReportDelay와 나눠 둔 이유가 이것이다: 백그라운드에서 돌아왔을 때는 0이 "회차가 밀렸으니
 * 지금 당장"이라는 뜻이라 그대로 써야 하고, 시도 직후의 0은 정반대로 읽어야 한다.
 */
export function gpsReportDelayAfterAttempt(now: number, intervalMs: number = GPS_REPORT_INTERVAL_MS): number {
  const remaining = gpsReportDelay(now, intervalMs);

  return remaining > 0 ? remaining : intervalMs;
}

/**
 * 좌표 → 요청 바디.
 *
 * 필드명이 서로 다르다(lat→latitude, lng→longitude). 순수 함수로 떼어 둔 이유는 이 매핑을
 * 뒤집어도 타입이 잡아주지 못하고(둘 다 number) 지구 반대편 좌표가 저장되는 걸로만 드러나기 때문이다.
 *
 * recordedAt은 toKstTimestamp를 그대로 쓴다. 서버가 offset이 붙은 값을 400으로 거절하므로
 * (kstTimestamp.ts 주석) 여기서 형식 규칙을 두 벌 갖지 않는다.
 */
export function toGpsSaveRequest(coords: { lat: number; lng: number }, at: Date): GeneratedApi.GpsSaveRequest {
  return { recordedAt: toKstTimestamp(at), latitude: coords.lat, longitude: coords.lng };
}

/** 테스트에서 모듈 스코프 상태를 초기화한다. 앱 코드에서는 쓰지 않는다. */
export function resetGpsReportGate(): void {
  lastReportedAt = null;
}
