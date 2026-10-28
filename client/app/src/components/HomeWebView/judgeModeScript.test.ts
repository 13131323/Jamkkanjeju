import { JUDGE_MODE_GLOBAL } from '@packages/shared';
import { describe, expect, it } from 'vitest';
import { buildJudgeModeScript } from './judgeModeScript';

describe('buildJudgeModeScript', () => {
  it.each([
    [true, 'true'],
    [false, 'false'],
  ])('%s를 전역에 심는다', (enabled, literal) => {
    expect(buildJudgeModeScript(enabled)).toContain(`window.${JUDGE_MODE_GLOBAL} = ${literal};`);
  });

  // 주입 스크립트의 마지막 평가값이 객체면 WebView가 네이티브로 직렬화하며 경고를 낸다
  // (authTokenScript.ts와 같은 이유). 값이 아니라 `true;`로 끝나야 한다.
  it('마지막 평가값이 true다', () => {
    expect(buildJudgeModeScript(true).trim().endsWith('true;')).toBe(true);
  });

  // 전역 이름을 문자열로 다시 적지 않는 것이 요점이다 — shared가 단일 출처다
  it('전역 이름은 shared의 상수를 쓴다', () => {
    expect(JUDGE_MODE_GLOBAL).toBe('__TAMNALOG_JUDGE_MODE__');
  });

  // 업데이트 직후 첫 실행. false로 심으면 web이 켜 두었던 모드를 덮어쓴다 —
  // "모른다"는 전역을 아예 만들지 않아야 web이 localStorage로 떨어진다.
  it('아직 모르면(null) 전역을 심지 않는다', () => {
    expect(buildJudgeModeScript(null)).not.toContain(JUDGE_MODE_GLOBAL);
  });

  it('아직 몰라도 마지막 평가값은 true다', () => {
    expect(buildJudgeModeScript(null).trim().endsWith('true;')).toBe(true);
  });
});
