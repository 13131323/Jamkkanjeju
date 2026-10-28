import { describe, expect, it } from 'vitest';
import { SHEET_DRAG_CLOSE_THRESHOLD_PX, shouldCloseSheetOnDragRelease } from './useSheetDrag';

describe('shouldCloseSheetOnDragRelease', () => {
  it('충분히 끌어내리면 닫는다', () => {
    expect(shouldCloseSheetOnDragRelease(SHEET_DRAG_CLOSE_THRESHOLD_PX + 1)).toBe(true);
  });

  it('문턱값만큼만 끌었으면 아직 닫지 않는다', () => {
    expect(shouldCloseSheetOnDragRelease(SHEET_DRAG_CLOSE_THRESHOLD_PX)).toBe(false);
  });

  it('조금만 끌면 닫지 않는다 — 제자리로 돌아가야 한다', () => {
    expect(shouldCloseSheetOnDragRelease(10)).toBe(false);
  });

  it('위로 끈 경우에는 닫히지 않는다', () => {
    expect(shouldCloseSheetOnDragRelease(-40)).toBe(false);
  });
});
