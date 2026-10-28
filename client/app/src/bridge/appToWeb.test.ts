import { describe, expect, it } from 'vitest';
import { AppToWebMessageSchema } from '.';

/**
 * 앱이 실제로 postMessage하는 envelope 모양을 그대로 검증한다. webToApp.test.ts와 같은
 * 이유·같은 패턴이다 — sendToWeb(app/src/bridge/utils.ts)이 `{ ...message, traceId }`로
 * 조립하므로 fixture도 payload와 traceId를 같은 층위에 둔다.
 */
const traceId = '11111111-2222-4333-8444-555555555555';

describe('AppToWebMessageSchema', () => {
  it('HARDWARE_BACK_PRESSED — payload 없이 받는다(심사위원 코드 모달이 열려 있을 때의 하드웨어 뒤로가기)', () => {
    expect(AppToWebMessageSchema.safeParse({ type: 'HARDWARE_BACK_PRESSED', payload: {}, traceId }).success).toBe(true);
  });

  it('traceId가 없으면 거른다 — sendToWeb이 주입하는 값이다', () => {
    expect(AppToWebMessageSchema.safeParse({ type: 'HARDWARE_BACK_PRESSED', payload: {} }).success).toBe(false);
  });

  it('기존 메시지가 함께 유효하다 — union에 항목을 추가하며 깨뜨리지 않았는지 확인한다', () => {
    expect(AppToWebMessageSchema.safeParse({ type: 'PONG', payload: { timestamp: 1 }, traceId }).success).toBe(true);
    expect(AppToWebMessageSchema.safeParse({ type: 'SAFE_AREA_UPDATE', payload: { top: 0, bottom: 0 }, traceId }).success).toBe(true);
  });
});
