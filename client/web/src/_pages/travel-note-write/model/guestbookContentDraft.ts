/**
 * 방명록 작성 1단계(내용 만들기)에서 "다음"을 누를 수 있는지 판단한다.
 *
 * **사진 또는 글**만 본다. 소리·날씨·컬러는 카드를 꾸미는 값이지 남길 내용이 아니라서,
 * 그것만 고른 방명록은 정작 아무것도 적지 않은 것과 같다. 온도는 애초에 구분도 되지 않는다 —
 * 기본값 18°C가 항상 들어 있어 "사용자가 넣은 것"과 "아무것도 안 한 것"이 같은 값이다.
 */

export type GuestbookContentDraft = {
  /** 목록에 몇 장이 있는지가 아니라 **카드에 올라간 사진이 있는지**. 골랐다 뺄 수 있다(토글) */
  hasSelectedPhoto: boolean;
  contentWriting: string;
};

export function hasAnyGuestbookContent(draft: GuestbookContentDraft): boolean {
  return draft.hasSelectedPhoto || draft.contentWriting.trim().length > 0;
}
