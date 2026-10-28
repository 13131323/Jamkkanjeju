import { describe, expect, it } from 'vitest';
import { isJudgeCodeComplete, JUDGE_CODE_LENGTH, normalizeJudgeCode, verifyJudgeCode } from './judgeCode';

const EXPECTED = '12345A';

describe('normalizeJudgeCode', () => {
  it('영문을 무조건 대문자로 바꾼다', () => {
    expect(normalizeJudgeCode('12345a')).toBe('12345A');
    expect(normalizeJudgeCode('abcdef')).toBe('ABCDEF');
  });

  it('최대 길이를 넘는 입력은 잘라낸다 — maxLength만으로는 붙여넣기를 못 막는다', () => {
    expect(normalizeJudgeCode('12345ABCDE')).toBe('12345A');
    expect(normalizeJudgeCode('12345A').length).toBe(JUDGE_CODE_LENGTH);
  });

  it('공백은 버린다 — 붙여넣기에 섞이면 보이지 않는 이유로 계속 틀린다', () => {
    expect(normalizeJudgeCode(' 12345 a ')).toBe('12345A');
    expect(normalizeJudgeCode('123\t45a\n')).toBe('12345A');
  });

  it('빈 입력은 빈 문자열이다', () => {
    expect(normalizeJudgeCode('')).toBe('');
  });
});

describe('isJudgeCodeComplete', () => {
  it('길이가 다 찼을 때만 참이다', () => {
    expect(isJudgeCodeComplete('12345')).toBe(false);
    expect(isJudgeCodeComplete('12345A')).toBe(true);
  });
});

describe('verifyJudgeCode', () => {
  it('정확히 일치하면 통과한다', () => {
    expect(verifyJudgeCode('12345A', EXPECTED)).toBe(true);
  });

  it('소문자로 입력해도 통과한다', () => {
    expect(verifyJudgeCode('12345a', EXPECTED)).toBe(true);
  });

  it('공백이 섞여도 통과한다', () => {
    expect(verifyJudgeCode(' 12345a ', EXPECTED)).toBe(true);
  });

  it('틀린 코드는 실패한다', () => {
    expect(verifyJudgeCode('12345B', EXPECTED)).toBe(false);
    expect(verifyJudgeCode('54321A', EXPECTED)).toBe(false);
  });

  it('길이가 모자라면 실패한다', () => {
    expect(verifyJudgeCode('12345', EXPECTED)).toBe(false);
  });

  // 여기가 이 함수의 존재 이유다 — 설정이 빠졌을 때 아무 코드로나 열리면 안 된다
  it('기대값이 비어 있으면 무엇을 넣어도 실패한다', () => {
    expect(verifyJudgeCode('12345A', undefined)).toBe(false);
    expect(verifyJudgeCode('12345A', '')).toBe(false);
    expect(verifyJudgeCode('', '')).toBe(false);
    expect(verifyJudgeCode('', undefined)).toBe(false);
  });

  it('기대값이 길이 미달이면 실패한다 — 잘못 설정된 env로 문이 열리지 않아야 한다', () => {
    expect(verifyJudgeCode('123', '123')).toBe(false);
  });

  it('env에 소문자·공백이 섞여도 의도대로 동작한다', () => {
    expect(verifyJudgeCode('12345A', ' 12345a ')).toBe(true);
  });
});
