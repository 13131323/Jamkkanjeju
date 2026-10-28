import { describe, expect, it } from 'vitest';
import { ENTER_MAX_WAIT_MS, ENTER_MIN_DWELL_MS, resolveJudgeEnterPhase } from './judgeTransition';

describe('resolveJudgeEnterPhase', () => {
  // 모드를 켠 직후에는 아직 리렌더 전이라 isReady가 옛 값(true)일 수 있다.
  // 최소 유지 구간이 없으면 그 한 프레임에 바로 빠져나가 연출이 없는 것과 같아진다.
  it('최소 유지 시간 전에는 준비가 끝나도 기다린다', () => {
    expect(resolveJudgeEnterPhase({ elapsedMs: 0, isReady: true })).toBe('holding');
    expect(resolveJudgeEnterPhase({ elapsedMs: ENTER_MIN_DWELL_MS - 1, isReady: true })).toBe('holding');
  });

  it('최소 유지 시간을 넘기고 준비가 끝나면 나간다', () => {
    expect(resolveJudgeEnterPhase({ elapsedMs: ENTER_MIN_DWELL_MS, isReady: true })).toBe('exiting');
  });

  it('준비가 안 끝났으면 최대 대기까지 붙잡는다', () => {
    expect(resolveJudgeEnterPhase({ elapsedMs: ENTER_MIN_DWELL_MS, isReady: false })).toBe('holding');
    expect(resolveJudgeEnterPhase({ elapsedMs: ENTER_MAX_WAIT_MS - 1, isReady: false })).toBe('holding');
  });

  // 네트워크가 느리다고 모달에 갇히면 안 된다 — 상한을 넘기면 준비 여부와 무관하게 나간다
  it('최대 대기를 넘기면 준비가 안 끝나도 나간다', () => {
    expect(resolveJudgeEnterPhase({ elapsedMs: ENTER_MAX_WAIT_MS, isReady: false })).toBe('exiting');
  });

  it('최소 유지가 최대 대기보다 짧다 — 두 상한이 뒤집히면 영영 안 나간다', () => {
    expect(ENTER_MIN_DWELL_MS).toBeLessThan(ENTER_MAX_WAIT_MS);
  });
});
