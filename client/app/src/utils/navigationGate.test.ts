import { beforeEach, describe, expect, it } from 'vitest';
import { acceptNavigation, NAVIGATION_GATE_INTERVAL_MS, resetNavigationGate } from './navigationGate';

describe('acceptNavigation', () => {
  beforeEach(() => {
    resetNavigationGate();
  });

  it('첫 전환은 통과시킨다', () => {
    expect(acceptNavigation(1_000)).toBe(true);
  });

  it('차단 구간 안의 두 번째 전환은 버린다', () => {
    expect(acceptNavigation(1_000)).toBe(true);
    expect(acceptNavigation(1_080)).toBe(false);
    expect(acceptNavigation(1_000 + NAVIGATION_GATE_INTERVAL_MS - 1)).toBe(false);
  });

  it('차단 구간이 지나면 다시 통과시킨다', () => {
    expect(acceptNavigation(1_000)).toBe(true);
    expect(acceptNavigation(1_000 + NAVIGATION_GATE_INTERVAL_MS)).toBe(true);
  });

  /** 이 훅이 있는 이유 자체. intro의 CTA를 두 번 치면 두 번째는 together의 CTA에 꽂힌다 */
  it('서로 다른 화면·버튼에서 온 연타도 한 번으로 접는다', () => {
    // 1탭: intro CTA → together로 push (통과)
    expect(acceptNavigation(1_000)).toBe(true);
    // 2탭: 이미 마운트된 together의 CTA에 꽂힘 → 버려야 한다
    expect(acceptNavigation(1_120)).toBe(false);
  });

  it('버려진 전환은 차단 구간을 늘리지 않는다', () => {
    expect(acceptNavigation(1_000)).toBe(true);
    expect(acceptNavigation(1_300)).toBe(false);
    // 통과 기준은 마지막으로 "통과시킨" 1_000이므로 1_400에는 열려 있어야 한다.
    // 버려진 입력으로 기준을 갱신하면 연타하는 동안 영구히 막힌다.
    expect(acceptNavigation(1_400)).toBe(true);
  });

  it('차단 구간을 직접 지정할 수 있다', () => {
    expect(acceptNavigation(1_000, 50)).toBe(true);
    expect(acceptNavigation(1_020, 50)).toBe(false);
    expect(acceptNavigation(1_100, 50)).toBe(true);
  });

  it('시계가 뒤로 돌아가도 영구 차단되지 않는다', () => {
    expect(acceptNavigation(5_000)).toBe(true);
    expect(acceptNavigation(1_000)).toBe(true);
  });
});
