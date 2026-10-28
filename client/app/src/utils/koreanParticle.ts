/**
 * 한글 조사 선택.
 *
 * 앞말의 **받침 유무**로 갈리는 조사(와/과, 은/는, 이/가 …)를 문구에 박아 두면 이름이 바뀌는 순간
 * 어색해진다 — 실제로 촬영 화면 안내가 "로컬 탐험가**과** 함께"로 떴다(기기에서 확인).
 * 서버가 주는 캐릭터·역할 이름을 문구에 끼우는 자리는 전부 이 함수를 거친다.
 */

/** 한글 음절 영역. 이 밖의 글자(영문·숫자·기호)는 받침을 따질 수 없다 */
const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
/** 한 초성당 음절 수 = 중성 21 × 종성 28. 종성 인덱스가 0이면 받침이 없다 */
const JONGSEONG_COUNT = 28;

/**
 * 마지막 글자에 받침이 있는지. 한글이 아니면 `null`(판단 불가).
 *
 * 영문·숫자로 끝나는 이름은 발음으로 갈려야 해서(예: "AR" → "AR과") 규칙을 세울 수 없다.
 * 그런 경우는 호출부가 정한 기본값을 쓴다.
 */
export function hasFinalConsonant(word: string): boolean | null {
  const last = word.trim().at(-1);
  if (last === undefined) return null;

  const code = last.charCodeAt(0);
  if (code < HANGUL_FIRST || code > HANGUL_LAST) return null;

  return (code - HANGUL_FIRST) % JONGSEONG_COUNT !== 0;
}

/**
 * 앞말에 맞는 조사를 골라 붙인다.
 *
 * @param word 조사 앞에 오는 말(캐릭터 이름 등)
 * @param withFinal 받침이 있을 때 쓸 조사(과·은·이 …)
 * @param withoutFinal 받침이 없을 때 쓸 조사(와·는·가 …)
 *
 * 한글이 아니어서 판단할 수 없으면 **받침이 있는 쪽**을 쓴다 — "AR와"보다 "AR과"가 덜 어색하다.
 */
export function joinWithParticle(word: string, withFinal: string, withoutFinal: string): string {
  return `${word}${hasFinalConsonant(word) === false ? withoutFinal : withFinal}`;
}
