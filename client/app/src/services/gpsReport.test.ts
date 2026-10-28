import { beforeEach, describe, expect, it } from 'vitest';
import { toKstTimestamp } from '@/utils/kstTimestamp';
import {
  acceptGpsReport,
  gpsReportDelay,
  gpsReportDelayAfterAttempt,
  GPS_REPORT_INTERVAL_MINUTES,
  GPS_REPORT_INTERVAL_MS,
  nextGpsReportDelay,
  resetGpsReportGate,
  shouldReportGps,
  toGpsSaveRequest,
} from './gpsReport';

/**
 * 위치 구독이 3초마다 콜백을 부르는데 서버 저장은 그보다 훨씬 드물게 나가야 한다.
 * 간격 판정이 어긋나면 "분당 20회 POST" 또는 "한 번도 안 보냄" 중 하나로 조용히 무너지므로
 * 경계값을 못박아 둔다.
 */
describe('shouldReportGps', () => {
  it('첫 전송(lastSentAt === null)은 무조건 보낸다 — 기준으로 삼을 직전 전송이 없다', () => {
    expect(shouldReportGps(null, 0, GPS_REPORT_INTERVAL_MS)).toBe(true);
  });

  it('간격이 아직 안 찼으면 보내지 않는다', () => {
    expect(shouldReportGps(1_000, 1_000 + GPS_REPORT_INTERVAL_MS - 1, GPS_REPORT_INTERVAL_MS)).toBe(false);
  });

  it('정확히 간격만큼 지났으면 보낸다 — 3초 콜백이 간격 경계에 딱 떨어지면 한 주기를 통째로 건너뛴다', () => {
    expect(shouldReportGps(1_000, 1_000 + GPS_REPORT_INTERVAL_MS, GPS_REPORT_INTERVAL_MS)).toBe(true);
  });

  it('간격을 넘겼으면 보낸다', () => {
    expect(shouldReportGps(1_000, 1_000 + GPS_REPORT_INTERVAL_MS + 1, GPS_REPORT_INTERVAL_MS)).toBe(true);
  });

  it('같은 시각에 두 번 물으면 두 번째는 막는다', () => {
    expect(shouldReportGps(5_000, 5_000, GPS_REPORT_INTERVAL_MS)).toBe(false);
  });

  it('now가 lastSentAt보다 과거여도 보내지 않는다 — 시계가 뒤로 가도 폭주하지 않는다', () => {
    expect(shouldReportGps(10_000, 9_000, GPS_REPORT_INTERVAL_MS)).toBe(false);
  });
});

describe('GPS_REPORT_INTERVAL_MS', () => {
  // 스펙이 "10분마다"로 못박은 값이라 범위가 아니라 정확한 값으로 고정한다.
  // 범위로 두면 예전처럼 30초짜리 값이 스펙과 어긋난 채 테스트를 통과한다.
  it('스펙이 정한 10분이다', () => {
    expect(GPS_REPORT_INTERVAL_MS).toBe(600_000);
  });

  /**
   * 백그라운드 태스크 등록값의 **단위**를 못박는다.
   *
   * expo-background-task의 minimumInterval은 분 단위인데 초로 착각하기 쉽고, 틀려도
   * 에러 없이 "태스크가 안 깬다"로만 드러난다(걸음 수 쪽이 실제로 `15 * 60`으로 틀려 있다).
   * 10분이 600이 아니라 10이어야 한다는 걸 여기서 고정한다.
   */
  it('백그라운드 등록값은 분 단위라 600이 아니라 10이다', () => {
    expect(GPS_REPORT_INTERVAL_MINUTES).toBe(10);
  });
});

/**
 * recordedAt은 "KST 기준 offset 없는" 문자열만 받는다. Date를 그대로 넣거나 toISOString을 쓰면
 * 타입은 통과하고 서버 400으로만 드러나므로 형식을 직접 확인한다.
 */
describe('toGpsSaveRequest', () => {
  it('좌표를 latitude/longitude로 옮긴다 — lat/lng와 필드명이 다르다', () => {
    const request = toGpsSaveRequest({ lat: 33.4996, lng: 126.5312 }, new Date(0));
    expect(request.latitude).toBe(33.4996);
    expect(request.longitude).toBe(126.5312);
  });

  it('recordedAt은 toKstTimestamp와 완전히 같은 값이다 — 형식 규칙을 두 벌 두지 않는다', () => {
    const at = new Date('2026-09-06T05:32:10.123Z');
    expect(toGpsSaveRequest({ lat: 0, lng: 0 }, at).recordedAt).toBe(toKstTimestamp(at));
  });

  it('recordedAt에 offset(Z, +09:00)도 밀리초도 붙지 않는다', () => {
    const recordedAt = toGpsSaveRequest({ lat: 0, lng: 0 }, new Date('2026-09-06T05:32:10.123Z')).recordedAt;
    expect(recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it('UTC가 아니라 KST 벽시계로 적는다 — UTC 05:32는 KST 14:32다', () => {
    expect(toGpsSaveRequest({ lat: 0, lng: 0 }, new Date('2026-09-06T05:32:10Z')).recordedAt).toBe('2026-09-06T14:32:10');
  });

  it('음수 좌표(남반구·서반구)도 그대로 보낸다', () => {
    expect(toGpsSaveRequest({ lat: -33.86, lng: -151.2 }, new Date(0))).toMatchObject({ latitude: -33.86, longitude: -151.2 });
  });

  it('적도·본초자오선의 0도 유효한 좌표다 — falsy라고 걸러내면 안 된다', () => {
    expect(toGpsSaveRequest({ lat: 0, lng: 0 }, new Date(0))).toMatchObject({ latitude: 0, longitude: 0 });
  });
});

/**
 * 게이트가 모듈 스코프인 게 핵심이다 — 홈 화면이 언마운트·재마운트돼도 간격이 이어져야 한다.
 * 판정과 기록을 한 함수에 묶었으므로 "통과시켰으면 반드시 기록됐다"를 여기서 확인한다.
 */
describe('acceptGpsReport', () => {
  beforeEach(() => {
    resetGpsReportGate();
  });

  it('첫 호출은 통과시킨다', () => {
    expect(acceptGpsReport(1_000)).toBe(true);
  });

  it('통과 직후의 호출은 막는다 — 통과시킬 때 시각이 기록됐다는 뜻이다', () => {
    acceptGpsReport(1_000);
    expect(acceptGpsReport(1_000 + GPS_REPORT_INTERVAL_MS - 1)).toBe(false);
  });

  it('3초마다 들어오는 콜백을 간격당 한 번만 통과시킨다', () => {
    const passed: number[] = [];
    for (let now = 0; now <= GPS_REPORT_INTERVAL_MS * 2; now += 3_000) {
      if (acceptGpsReport(now)) passed.push(now);
    }
    expect(passed).toEqual([0, GPS_REPORT_INTERVAL_MS, GPS_REPORT_INTERVAL_MS * 2]);
  });

  it('막힌 호출은 기준 시각을 밀지 않는다 — 막을 때마다 갱신하면 영원히 못 보낸다', () => {
    acceptGpsReport(0);
    acceptGpsReport(3_000);
    acceptGpsReport(6_000);
    expect(acceptGpsReport(GPS_REPORT_INTERVAL_MS)).toBe(true);
  });
});

/**
 * 정기 전송 타이머(useHomeBridge)가 다음 회차를 잡는 근거.
 *
 * 구독은 `distanceInterval: 5`라 가만히 있으면 콜백이 오지 않으므로, 스펙의 "10분마다"는
 * 타이머가 지킨다. 그 타이머가 언제 깰지를 여기서 정한다.
 */
describe('nextGpsReportDelay', () => {
  it('한 번도 안 보냈으면 0 — 기다리지 않고 바로 첫 전송을 낸다', () => {
    expect(nextGpsReportDelay(null, 12_345, GPS_REPORT_INTERVAL_MS)).toBe(0);
  });

  it('방금 보냈으면 꼬박 한 간격을 기다린다', () => {
    expect(nextGpsReportDelay(1_000, 1_000, GPS_REPORT_INTERVAL_MS)).toBe(GPS_REPORT_INTERVAL_MS);
  });

  it('절반쯤 지났으면 남은 절반만 기다린다', () => {
    expect(nextGpsReportDelay(1_000, 1_000 + GPS_REPORT_INTERVAL_MS / 2, GPS_REPORT_INTERVAL_MS)).toBe(GPS_REPORT_INTERVAL_MS / 2);
  });

  it('간격이 딱 찬 순간은 0이다 — shouldReportGps가 통과시키는 경계와 같아야 한다', () => {
    const now = 1_000 + GPS_REPORT_INTERVAL_MS;
    expect(nextGpsReportDelay(1_000, now, GPS_REPORT_INTERVAL_MS)).toBe(0);
    expect(shouldReportGps(1_000, now, GPS_REPORT_INTERVAL_MS)).toBe(true);
  });

  it('이미 한참 지났어도 음수가 아니라 0이다 — setTimeout에 음수를 넘기지 않는다', () => {
    expect(nextGpsReportDelay(1_000, 1_000 + GPS_REPORT_INTERVAL_MS * 5, GPS_REPORT_INTERVAL_MS)).toBe(0);
  });
});

/**
 * 게이트를 읽는 쪽(gpsReportDelay)과 게이트를 닫는 쪽(acceptGpsReport)이 같은 시각을 봐야 한다.
 * 여기가 어긋나면 타이머가 깬 회차를 게이트가 막아 실제 주기가 20분이 된다.
 */
describe('gpsReportDelay', () => {
  beforeEach(() => {
    resetGpsReportGate();
  });

  it('아직 아무것도 안 보냈으면 0이다', () => {
    expect(gpsReportDelay(50_000)).toBe(0);
  });

  it('전송 직후에는 꼬박 한 간격이 남는다', () => {
    acceptGpsReport(1_000);
    expect(gpsReportDelay(1_000)).toBe(GPS_REPORT_INTERVAL_MS);
  });

  it('immediate 전송(간격 0)도 위상을 밀어 다음 회차를 그 시점부터 센다', () => {
    // 앱 시작 직후·심사위원 모드 토글의 전송이 이 형태다(gpsSender의 immediate)
    acceptGpsReport(100, 0);
    expect(gpsReportDelay(100)).toBe(GPS_REPORT_INTERVAL_MS);
  });

  it('고정 위상 타이머였다면 통째로 건너뛰었을 회차를 건너뛰지 않는다', () => {
    // 시작 직후 immediate 전송이 위상을 t=100에 찍는다.
    acceptGpsReport(100, 0);

    // setInterval처럼 t=간격에 깨면 100ms가 모자라 게이트가 막는다 — 이게 예전 구조의 함정이다.
    expect(acceptGpsReport(GPS_REPORT_INTERVAL_MS)).toBe(false);

    // 남은 시간을 게이트에 다시 물으면 정확히 그 100ms를 알려준다.
    expect(gpsReportDelay(GPS_REPORT_INTERVAL_MS)).toBe(100);
    expect(acceptGpsReport(GPS_REPORT_INTERVAL_MS + 100)).toBe(true);
  });

  it('타이머를 남은 시간으로 다시 잡으면 정확히 10분 간격이 이어진다', () => {
    // 앱 시작 직후 1회 전송
    acceptGpsReport(100, 0);

    // useHomeBridge의 타이머 루프: 남은 시간만큼 자고 → 전송 → 다시 남은 시간을 묻는다
    const sentAt = [100];
    let now = 100;
    for (let round = 0; round < 3; round += 1) {
      now += gpsReportDelay(now);
      if (acceptGpsReport(now)) sentAt.push(now);
    }

    expect(sentAt).toEqual([100, 600_100, 1_200_100, 1_800_100]);
  });

  it('측위가 실패해 아무것도 못 보낸 회차는 곧장 재시도하지 않는다', () => {
    // 게이트가 비어 있다 = 이번 시도가 전송으로 이어지지 않았다.
    // 남은 시간은 0이지만(gpsReportDelay) 시도 직후에는 그 0을 "지금 당장"으로 읽으면 안 된다.
    expect(gpsReportDelay(0)).toBe(0);
    expect(gpsReportDelayAfterAttempt(0)).toBe(GPS_REPORT_INTERVAL_MS);
  });

  it('회차가 밀린 상태에서 측위까지 실패해도 재시도가 꼬리를 물지 않는다', () => {
    acceptGpsReport(0);

    // 마지막 전송으로부터 한참 지났으니 gpsReportDelay는 0이다(밀린 회차를 지금 따라잡으라는 뜻).
    const muchLater = GPS_REPORT_INTERVAL_MS * 3;
    expect(gpsReportDelay(muchLater)).toBe(0);

    // 그런데 방금 시도해서 실패한 참이라면 얘기가 다르다 — 다음 회차까지 기다린다.
    expect(gpsReportDelayAfterAttempt(muchLater)).toBe(GPS_REPORT_INTERVAL_MS);
  });

  it('전송이 성사된 직후에는 꼬박 한 간격을 기다린다', () => {
    acceptGpsReport(7_000);
    expect(gpsReportDelayAfterAttempt(7_000)).toBe(GPS_REPORT_INTERVAL_MS);
  });

  it('이동 콜백이 먼저 보내 간 회차는 타이머가 스스로 보정한다', () => {
    acceptGpsReport(0);

    // 타이머가 깨기 1초 전에 5m를 움직여 구독 콜백이 전송을 가져갔다
    const movedAt = GPS_REPORT_INTERVAL_MS + 1_000;
    expect(acceptGpsReport(movedAt)).toBe(true);

    // 그 시점에 깬 타이머는 아직 차례가 아님을 알고(> 0) 남은 시간만큼 다시 잡는다
    expect(gpsReportDelay(movedAt)).toBe(GPS_REPORT_INTERVAL_MS);
    expect(acceptGpsReport(movedAt + GPS_REPORT_INTERVAL_MS)).toBe(true);
  });
});
