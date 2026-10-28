/**
 * 심사위원용 모드 진입 코드.
 *
 * 정규화와 검증을 순수 함수로 분리해 둔다 — 입력 제한(대문자·6자)은 모달 UI가 매 입력마다
 * 부르고, 검증은 "입장하기"를 눌렀을 때 한 번만 부른다.
 */

/** 입력 가능한 최대 길이. 이 이상은 입력 자체가 되지 않아야 한다 */
export const JUDGE_CODE_LENGTH = 6;

/**
 * 입력값을 코드 형태로 다듬는다.
 *
 * - 영문은 **무조건 대문자**로 바꾼다(요구사항). 소문자로 입력해도 통과해야 한다.
 * - 길이를 넘는 입력은 잘라 버린다. `maxLength`만으로는 붙여넣기·IME 조합을 다 막지 못한다.
 * - 공백은 버린다 — 붙여넣기에 섞여 들어오면 사용자는 보이지 않는 이유로 계속 틀린다.
 */
export function normalizeJudgeCode(raw: string): string {
  return raw
    .replace(/\s+/g, '')
    .toUpperCase()
    .slice(0, JUDGE_CODE_LENGTH);
}

/** 길이가 다 찼는가 = "입장하기"를 누를 수 있는가 */
export function isJudgeCodeComplete(code: string): boolean {
  return code.length === JUDGE_CODE_LENGTH;
}

/**
 * 입력한 코드가 맞는지.
 *
 * 기대값은 `NEXT_PUBLIC_JUDGE_MODE_CODE`로 받는다. **설정이 비어 있으면 무엇을 넣어도 실패한다** —
 * 빈 기대값을 빈 입력과 맞춰 통과시키면 아무 코드로나 열리는 문이 된다.
 *
 * 기대값도 같은 정규화를 거친다. env에 소문자나 공백이 섞여 들어와도 의도대로 동작해야 한다.
 */
export function verifyJudgeCode(code: string, expected: string | undefined): boolean {
  const normalizedExpected = normalizeJudgeCode(expected ?? '');
  if (!isJudgeCodeComplete(normalizedExpected)) return false;

  return normalizeJudgeCode(code) === normalizedExpected;
}
