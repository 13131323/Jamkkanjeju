import { describe, expect, it } from 'vitest';
import { WebToAppMessageSchema } from '.';

/**
 * web이 실제로 postMessage하는 envelope 모양을 그대로 검증한다.
 *
 * sendToApp(web/src/shared/lib/bridge/utils.ts)이 `{ ...message, traceId }`로 조립하므로
 * 여기 fixture도 payload와 traceId를 같은 층위에 둔다. 스키마가 discriminatedUnion이라
 * 한 항목의 payload 모양이 어긋나면 그 메시지가 통째로 걸러져 화면이 조용히 먹통이 된다 —
 * 계약이 깨졌을 때 실기기까지 가지 않고 여기서 잡으려는 테스트다.
 */
const traceId = '11111111-2222-4333-8444-555555555555';

describe('WebToAppMessageSchema', () => {
  it('TREASURE_MARKER_PRESS — 숫자 treasureIndex를 받는다', () => {
    const result = WebToAppMessageSchema.safeParse({ type: 'TREASURE_MARKER_PRESS', payload: { treasureIndex: 1 }, traceId });

    expect(result.success).toBe(true);
  });

  it('TREASURE_MARKER_PRESS — 문자열 treasureIndex는 거른다(web이 treasureId를 그대로 보내면 안 된다)', () => {
    const result = WebToAppMessageSchema.safeParse({ type: 'TREASURE_MARKER_PRESS', payload: { treasureIndex: '1' }, traceId });

    expect(result.success).toBe(false);
  });

  it('TREASURE_MARKER_PRESS — 0·음수·소수는 거른다(보물 번호는 1부터인 정수다)', () => {
    for (const treasureIndex of [0, -1, 1.5]) {
      expect(WebToAppMessageSchema.safeParse({ type: 'TREASURE_MARKER_PRESS', payload: { treasureIndex }, traceId }).success).toBe(false);
    }
  });

  it('traceId가 없으면 거른다 — sendToApp이 주입하는 값이다', () => {
    const result = WebToAppMessageSchema.safeParse({ type: 'TREASURE_MARKER_PRESS', payload: { treasureIndex: 1 } });

    expect(result.success).toBe(false);
  });

  it('NAVIGATE_BACK — payload 없이 받는다(web 헤더의 뒤로가기를 앱 스택으로 넘긴다)', () => {
    expect(WebToAppMessageSchema.safeParse({ type: 'NAVIGATE_BACK', payload: {}, traceId }).success).toBe(true);
  });

  it('CHARACTER_PHOTO — 도감이 넘기는 캐릭터 셋을 받는다', () => {
    const payload = { characterId: 'wind-spirit', name: '바람 정령', imageUrl: 'https://tamnalog.example/_next/static/media/wind.png' };

    expect(WebToAppMessageSchema.safeParse({ type: 'CHARACTER_PHOTO', payload, traceId }).success).toBe(true);
  });

  it('CHARACTER_PHOTO — 상대 경로 이미지는 거른다(앱이 어디서 받을지 알 수 없다)', () => {
    // web이 `image.src`(예: /_next/static/...)를 그대로 보내면 앱에서 조용히 캐릭터가 사라진다.
    // 그 실수를 계약에서 막는다 — web은 자기 origin을 붙여 절대 URL로 보내야 한다.
    const payload = { characterId: 'wind-spirit', name: '바람 정령', imageUrl: '/_next/static/media/wind.png' };

    expect(WebToAppMessageSchema.safeParse({ type: 'CHARACTER_PHOTO', payload, traceId }).success).toBe(false);
  });

  it('CHARACTER_PHOTO — 빈 id·이름은 거른다', () => {
    const base = { characterId: 'wind-spirit', name: '바람 정령', imageUrl: 'https://tamnalog.example/wind.png' };

    expect(WebToAppMessageSchema.safeParse({ type: 'CHARACTER_PHOTO', payload: { ...base, characterId: '' }, traceId }).success).toBe(false);
    expect(WebToAppMessageSchema.safeParse({ type: 'CHARACTER_PHOTO', payload: { ...base, name: '' }, traceId }).success).toBe(false);
  });

  it('SAVE_IMAGE — data URL과 파일 이름을 받는다', () => {
    const payload = { dataUrl: 'data:image/png;base64,iVBORw0KGgo=', fileName: 'tamnalog-spotted-seal' };

    expect(WebToAppMessageSchema.safeParse({ type: 'SAVE_IMAGE', payload, traceId }).success).toBe(true);
  });

  it('SAVE_IMAGE — 이미지가 아닌 data URL은 거른다', () => {
    // 앱은 받은 문자열을 파일로 써서 갤러리에 넣는다. 이미지가 아니면 그 자리에서 실패할 뿐이라
    // 계약에서 먼저 막는다.
    const payload = { dataUrl: 'data:text/html;base64,PGh0bWw+', fileName: 'card' };

    expect(WebToAppMessageSchema.safeParse({ type: 'SAVE_IMAGE', payload, traceId }).success).toBe(false);
  });

  it('SAVE_IMAGE — 경로 구분자가 든 파일 이름은 거른다', () => {
    // 파일 이름이 그대로 캐시 경로에 붙으므로 `../`가 섞이면 엉뚱한 곳에 쓴다
    const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';

    expect(WebToAppMessageSchema.safeParse({ type: 'SAVE_IMAGE', payload: { dataUrl, fileName: '../secret' }, traceId }).success).toBe(false);
    expect(WebToAppMessageSchema.safeParse({ type: 'SAVE_IMAGE', payload: { dataUrl, fileName: 'a/b' }, traceId }).success).toBe(false);
  });

  it('JUDGE_CODE_MODAL_STATE — 모달이 열렸는지를 불리언으로 받는다', () => {
    expect(WebToAppMessageSchema.safeParse({ type: 'JUDGE_CODE_MODAL_STATE', payload: { isOpen: true }, traceId }).success).toBe(true);
    expect(WebToAppMessageSchema.safeParse({ type: 'JUDGE_CODE_MODAL_STATE', payload: { isOpen: false }, traceId }).success).toBe(true);
  });

  it('JUDGE_CODE_MODAL_STATE — isOpen이 불리언이 아니면 거른다', () => {
    expect(WebToAppMessageSchema.safeParse({ type: 'JUDGE_CODE_MODAL_STATE', payload: { isOpen: 'true' }, traceId }).success).toBe(false);
  });

  it('기존 메시지가 함께 유효하다 — union에 항목을 추가하며 깨뜨리지 않았는지 확인한다', () => {
    expect(WebToAppMessageSchema.safeParse({ type: 'PING', payload: { timestamp: 1 }, traceId }).success).toBe(true);
    expect(WebToAppMessageSchema.safeParse({ type: 'LOCATION_PERMISSION_REQUEST', payload: {}, traceId }).success).toBe(true);
    expect(WebToAppMessageSchema.safeParse({ type: 'NAVIGATE', payload: { route: 'treasure-mission', missionId: 1 }, traceId }).success).toBe(true);
    // missionId는 옛 web 빌드 호환을 위해 optional이다
    expect(WebToAppMessageSchema.safeParse({ type: 'NAVIGATE', payload: { route: 'treasure-mission' }, traceId }).success).toBe(true);
  });
});
