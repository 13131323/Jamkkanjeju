import { describe, expect, it } from 'vitest';
import { JUDGE_MODE_GLOBAL, parseInjectedJudgeMode } from './index';

/**
 * 앱이 심고 web이 읽는 전역의 계약. 두 패키지가 각자 문자열을 적지 않는다는 것이 요점이다.
 */
describe('JUDGE_MODE_GLOBAL', () => {
  // 이름이 바뀌면 심는 쪽·읽는 쪽이 함께 바뀌어야 한다 — 한쪽만 바뀌면 조용히 "값 없음"이 된다
  it('전역 이름은 window 속성으로 쓸 수 있는 식별자다', () => {
    expect(JUDGE_MODE_GLOBAL).toMatch(/^[A-Za-z_$][\w$]*$/);
  });
});

describe('parseInjectedJudgeMode', () => {
  it('true만 켜짐이다', () => {
    expect(parseInjectedJudgeMode(true)).toBe(true);
  });

  // 앱이 낡아 전역을 아예 심지 않는 경우. web은 이때 localStorage로 떨어진다
  it('심지 않았으면(undefined) 꺼짐이다', () => {
    expect(parseInjectedJudgeMode(undefined)).toBe(false);
  });

  // 불리언이 아닌 값을 켜짐으로 읽으면 낡은 앱의 아무 값이나 모드를 켜게 된다
  it.each([['true'], ['false'], [1], [0], [null], [{}]])('불리언이 아닌 %s는 꺼짐으로 접는다', (value) => {
    expect(parseInjectedJudgeMode(value)).toBe(false);
  });
});
