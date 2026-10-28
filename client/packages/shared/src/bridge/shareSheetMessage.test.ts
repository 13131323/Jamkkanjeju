import { describe, expect, it } from 'vitest';
import { WEB_TO_APP_MESSAGE_TYPES, WebToAppMessageSchema } from './index';

/**
 * `SHARE_SHEET`(web → app) 계약.
 *
 * 이 메시지는 **앱이 검증한다**. 낡은 앱이 받으면 discriminated union에서 통째로 걸러져 공유 버튼이
 * 조용히 먹통이 되므로(index.ts 상단 경고), 필드를 하나 늘리거나 조일 때 여기가 먼저 깨져야 한다.
 */
const VALID = {
  type: 'SHARE_SHEET',
  payload: { url: 'https://cdn.tamnalog.app/postcards/1.png', headline: '제주 여행 엽서를 보내요', mailSubject: '잠깐제주 여행 엽서' },
  traceId: 'trace-1',
};

describe('SHARE_SHEET', () => {
  it('이 번들이 아는 type이다 — 목록에 없으면 수신부가 "상대가 더 새 번들"로 보고 조용히 무시한다', () => {
    expect(WEB_TO_APP_MESSAGE_TYPES.has('SHARE_SHEET')).toBe(true);
  });

  it('url·headline·mailSubject를 그대로 통과시킨다', () => {
    const result = WebToAppMessageSchema.safeParse(VALID);
    expect(result.success).toBe(true);
    expect(result.success && result.data.payload).toEqual(VALID.payload);
  });

  it('mailSubject는 없어도 된다 — 없으면 공유 규칙이 headline을 제목으로 쓴다', () => {
    const { mailSubject: _omitted, ...payload } = VALID.payload;
    expect(WebToAppMessageSchema.safeParse({ ...VALID, payload }).success).toBe(true);
  });

  it('빈 url은 거른다 — 안내 문구만 남은 글은 받는 사람이 들어올 방법이 없다', () => {
    expect(WebToAppMessageSchema.safeParse({ ...VALID, payload: { ...VALID.payload, url: '' } }).success).toBe(false);
  });

  it('빈 headline도 거른다 — 링크만 덩그러니 보내는 건 이 시트가 하려던 일이 아니다', () => {
    expect(WebToAppMessageSchema.safeParse({ ...VALID, payload: { ...VALID.payload, headline: '' } }).success).toBe(false);
  });

  it('url을 형식으로 조이지는 않는다 — 시트는 주소를 해석하지 않고 본문에 붙여 넘길 뿐이다', () => {
    expect(WebToAppMessageSchema.safeParse({ ...VALID, payload: { ...VALID.payload, url: 'tamnalog://postcard/1' } }).success).toBe(true);
  });
});
