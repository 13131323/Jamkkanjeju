/** 회원탈퇴 확정에 필요한 확인 문구. 정확히 일치해야 탈퇴 버튼이 활성화된다 */
export const WITHDRAW_CONFIRM_PHRASE = '탈퇴하겠습니다';

export function isWithdrawPhraseComplete(input: string): boolean {
  return input === WITHDRAW_CONFIRM_PHRASE;
}
