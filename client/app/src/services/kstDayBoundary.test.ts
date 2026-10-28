import { describe, expect, it } from 'vitest';
import { msUntilNextKstMidnight } from './kstDayBoundary';

/**
 * getTodayKST를 직접 import하지 않는다. stepCounterService는 react-native 네이티브 모듈과
 * SQLite를 런타임 import하므로 vitest(플레인 node)에서 불러오면 Flow 구문을 파싱하지 못해 죽는다
 * (stepCountRequest.ts 주석의 같은 이유). 그래서 그쪽 계산식을 여기 그대로 옮겨 경계를 비교한다 —
 * 두 곳이 어긋나면 이 테스트가 깨진다.
 */
function todayKstOf(epochMs: number): string {
  return new Date(epochMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 주어진 KST 시각(offset 없는 표기)을 epoch ms로 */
function kst(iso: string): number {
  return Date.parse(`${iso}+09:00`);
}

describe('msUntilNextKstMidnight', () => {
  it('KST 자정 직후에는 거의 하루가 남는다', () => {
    expect(msUntilNextKstMidnight(kst('2026-09-05T00:00:01'))).toBe(DAY_MS - 1000);
  });

  it('KST 자정 1분 전에는 1분이 남는다', () => {
    expect(msUntilNextKstMidnight(kst('2026-09-05T23:59:00'))).toBe(60 * 1000);
  });

  it('정오에는 12시간이 남는다', () => {
    expect(msUntilNextKstMidnight(kst('2026-09-05T12:00:00'))).toBe(12 * 60 * 60 * 1000);
  });

  it('정확히 자정인 순간에는 0이 아니라 하루를 준다 — 0이면 타이머가 같은 경계에서 반복된다', () => {
    expect(msUntilNextKstMidnight(kst('2026-09-05T00:00:00'))).toBe(DAY_MS);
  });

  it('항상 0보다 크고 하루 이하다', () => {
    for (const hour of [0, 3, 9, 15, 21, 23]) {
      const value = msUntilNextKstMidnight(kst(`2026-09-05T${String(hour).padStart(2, '0')}:37:11`));
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(DAY_MS);
    }
  });

  /**
   * 저장 키(getTodayKST)와 같은 경계를 봐야 한다. 어긋나면 화면은 0으로 리셋했는데 델타가
   * 어제 행에 계속 쌓이거나 그 반대가 된다.
   */
  it('이 시간만큼 기다리면 저장 키(KST 날짜)가 실제로 다음 날로 넘어간다', () => {
    const now = kst('2026-09-05T23:30:00');
    const boundary = now + msUntilNextKstMidnight(now);

    expect(todayKstOf(boundary - 1)).toBe('2026-09-05');
    expect(todayKstOf(boundary)).toBe('2026-09-06');
  });
});
