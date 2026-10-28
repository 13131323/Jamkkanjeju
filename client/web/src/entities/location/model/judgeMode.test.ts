import { describe, expect, it } from 'vitest';
import { parseStoredJudgeMode } from './judgeMode';

// useJudgeModeHydration이 되살릴 때 쓰는 순수 판정. 스토어(zustand)·window 없이 이 갈래만 검증한다 —
// 나머지는 effect 배선이라 vitest(environment: node)로 직접 부를 수 없다(useHomeData.test.ts류 부재와 같은 이유).
describe('parseStoredJudgeMode', () => {
  it("저장값이 'true'면 켜짐이다", () => {
    expect(parseStoredJudgeMode('true')).toBe(true);
  });

  it("저장값이 'false'면 꺼짐이다", () => {
    expect(parseStoredJudgeMode('false')).toBe(false);
  });

  // 한 번도 저장한 적 없거나(null) localStorage 접근이 막힌 경우(useJudgeModeHydration이 null로 넘긴다)
  it('저장값이 없으면(null) 꺼짐으로 본다', () => {
    expect(parseStoredJudgeMode(null)).toBe(false);
  });

  // persist()가 남기는 값은 'true'/'false' 둘뿐이지만, 예전 빌드가 남긴 값이나 수동 조작으로
  // 손상된 값이 올 수 있다 — 안전한 쪽(꺼짐)으로 접는다.
  it('알 수 없는 값은 꺼짐으로 접는다', () => {
    expect(parseStoredJudgeMode('garbage')).toBe(false);
  });
});
