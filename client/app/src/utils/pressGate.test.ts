import { describe, expect, it } from 'vitest';
import { SINGLE_PRESS_INTERVAL_MS, shouldAcceptPress } from './pressGate';

describe('shouldAcceptPress', () => {
  it('첫 입력은 통과시킨다', () => {
    expect(shouldAcceptPress(null, 1_000)).toBe(true);
  });

  it('차단 구간 안의 두 번째 입력은 버린다', () => {
    expect(shouldAcceptPress(1_000, 1_001)).toBe(false);
    expect(shouldAcceptPress(1_000, 1_000 + SINGLE_PRESS_INTERVAL_MS - 1)).toBe(false);
  });

  it('차단 구간이 지나면 다시 통과시킨다', () => {
    expect(shouldAcceptPress(1_000, 1_000 + SINGLE_PRESS_INTERVAL_MS)).toBe(true);
    expect(shouldAcceptPress(1_000, 5_000)).toBe(true);
  });

  it('차단 구간 안의 연타 3번은 첫 번째만 통과한다 (실제 사용 순서 재현)', () => {
    let lastAcceptedAt: number | null = null;
    const accepted: number[] = [];

    // 세 번이 모두 차단 구간 안에 들어오도록 간격을 구간에서 계산한다.
    // 간격을 상수로 박아 두면 SINGLE_PRESS_INTERVAL_MS를 조정할 때 테스트가 먼저 깨진다.
    const gap = Math.floor(SINGLE_PRESS_INTERVAL_MS / 3);
    for (const now of [1_000, 1_000 + gap, 1_000 + gap * 2]) {
      if (shouldAcceptPress(lastAcceptedAt, now)) {
        lastAcceptedAt = now;
        accepted.push(now);
      }
    }

    expect(accepted).toEqual([1_000]);
  });

  it('차단 구간을 직접 지정할 수 있다', () => {
    expect(shouldAcceptPress(1_000, 1_100, 50)).toBe(true);
    expect(shouldAcceptPress(1_000, 1_020, 50)).toBe(false);
  });

  it('시계가 뒤로 돌아가도 영구 차단되지 않는다', () => {
    expect(shouldAcceptPress(5_000, 1_000)).toBe(true);
  });
});
