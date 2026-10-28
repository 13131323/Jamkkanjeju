import { describe, expect, it } from 'vitest';
import { SHEET_DRAG_CLOSE_DISTANCE, SHEET_DRAG_CLOSE_VELOCITY, SHEET_DRAG_START_DISTANCE, shouldCloseOnDragRelease, shouldStartSheetDrag } from './bottomSheetDrag';

describe('shouldCloseOnDragRelease', () => {
  it('충분히 끌어내리면 닫는다', () => {
    expect(shouldCloseOnDragRelease(SHEET_DRAG_CLOSE_DISTANCE + 1, 0)).toBe(true);
  });

  it('짧게 끌었지만 빠르게 튕기면 닫는다 — 플릭도 닫으려는 의도다', () => {
    expect(shouldCloseOnDragRelease(10, SHEET_DRAG_CLOSE_VELOCITY + 0.1)).toBe(true);
  });

  it('조금 끌고 천천히 놓으면 닫지 않는다 — 제자리로 돌아가야 한다', () => {
    expect(shouldCloseOnDragRelease(10, 0.1)).toBe(false);
    expect(shouldCloseOnDragRelease(SHEET_DRAG_CLOSE_DISTANCE, SHEET_DRAG_CLOSE_VELOCITY)).toBe(false);
  });

  it('위로 튕기는 손짓으로는 닫히지 않는다', () => {
    expect(shouldCloseOnDragRelease(-120, -2)).toBe(false);
  });
});

describe('shouldStartSheetDrag', () => {
  it('아래로 문턱을 넘게 움직이면 드래그로 인정한다', () => {
    expect(shouldStartSheetDrag(SHEET_DRAG_START_DISTANCE + 1, 0)).toBe(true);
  });

  it('탭 수준의 미세한 움직임은 드래그가 아니다', () => {
    expect(shouldStartSheetDrag(1, 0)).toBe(false);
    expect(shouldStartSheetDrag(SHEET_DRAG_START_DISTANCE, 0)).toBe(false);
  });

  it('가로가 더 큰 움직임은 드래그가 아니다 — 지도를 좌우로 쓸어도 시트가 안 내려와야 한다', () => {
    expect(shouldStartSheetDrag(10, 40)).toBe(false);
    expect(shouldStartSheetDrag(10, -40)).toBe(false);
  });

  it('위로 향한 움직임은 드래그가 아니다 — 시트가 제자리보다 올라갈 자리가 없다', () => {
    expect(shouldStartSheetDrag(-40, 0)).toBe(false);
  });
});
