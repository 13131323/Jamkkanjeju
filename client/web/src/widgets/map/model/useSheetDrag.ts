'use client';

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * 핸들을 이만큼(px) 이상 아래로 끌어내리면 놓는 순간 닫는다.
 *
 * BottomToolSheet(travel-note-write/TravelNoteWritePage)의 SHEET_DRAG_CLOSE_THRESHOLD 패턴을
 * 따르되 값은 지도 시트 쪽 선례(PlaceModalCard·CouponModalCard가 먼저 맞춰 둔 80)를 그대로 쓴다.
 */
export const SHEET_DRAG_CLOSE_THRESHOLD_PX = 80;

/** 이만큼 끌어내리고 놓으면 닫아야 하는지 */
export function shouldCloseSheetOnDragRelease(dragY: number): boolean {
  return dragY > SHEET_DRAG_CLOSE_THRESHOLD_PX;
}

/**
 * 지도 위 하단 시트를 손으로 끌어내려 닫는 공용 로직.
 *
 * BottomToolSheet가 쓰던 dragY state + pointer 이벤트 패턴을 지도 시트들(PlaceModalCard·
 * MissionModalCard·FilteredMissionModalCard)이 함께 쓰도록 뽑았다. 반환하는 dragHandlers는
 * 잡이/헤더처럼 드래그로만 반응해야 할 영역에만 달아야 한다 — 본문에 스크롤 영역이 있는 시트는
 * 거기에 달면 스크롤과 드래그가 충돌한다.
 */
export function useSheetDragToClose(onClose: () => void) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number | null>(null);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragStartYRef.current = e.clientY;
    setIsDragging(true);
    // 잡이 밖으로 손가락이 나가도 move가 계속 오게 잡아 둔다 — 없으면 빠르게 끌 때 시트가 중간에 멈춘다
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragStartYRef.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStartYRef.current));
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    // 이미 놓인 포인터를 다시 놓으면 NotFoundError가 난다 — 들고 있을 때만 놓는다
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (shouldCloseSheetOnDragRelease(dragY)) onClose();
    setDragY(0);
    setIsDragging(false);
    dragStartYRef.current = null;
  }

  return {
    dragY,
    isDragging,
    dragHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
  };
}
