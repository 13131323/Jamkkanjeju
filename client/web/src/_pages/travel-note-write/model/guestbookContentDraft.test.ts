import { describe, expect, it } from 'vitest';
import { hasAnyGuestbookContent, type GuestbookContentDraft } from './guestbookContentDraft';

const EMPTY: GuestbookContentDraft = { hasSelectedPhoto: false, contentWriting: '' };

function draft(partial: Partial<GuestbookContentDraft>): GuestbookContentDraft {
  return { ...EMPTY, ...partial };
}

describe('방명록 1단계 "다음" 활성화 조건', () => {
  it('아무것도 넣지 않았으면 비활성이다', () => {
    expect(hasAnyGuestbookContent(EMPTY)).toBe(false);
  });

  it('사진을 고르면 활성이다', () => {
    expect(hasAnyGuestbookContent(draft({ hasSelectedPhoto: true }))).toBe(true);
  });

  it('글을 적으면 활성이다', () => {
    expect(hasAnyGuestbookContent(draft({ contentWriting: '성산일출봉 다녀왔어요' }))).toBe(true);
  });

  it('공백만 적은 글은 저장 시 null로 떨어지므로 넣은 것으로 보지 않는다', () => {
    expect(hasAnyGuestbookContent(draft({ contentWriting: '   \n ' }))).toBe(false);
  });

  it('고른 사진을 다시 눌러 빼면 글이 없는 한 다시 비활성이다 — 사진첩에서 가져온 목록은 남아 있어도 카드는 비어 있다', () => {
    expect(hasAnyGuestbookContent(draft({ hasSelectedPhoto: false, contentWriting: '' }))).toBe(false);
  });
});
