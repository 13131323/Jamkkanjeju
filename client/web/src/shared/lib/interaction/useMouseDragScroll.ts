'use client';

import { useRef, type PointerEvent as ReactPointerEvent, type MouseEvent, type DragEvent } from 'react';

/** 가로 목록은 마우스로 끌고 터치는 기본 스크롤을 사용한다. 짧은 클릭은 내부 버튼에 전달한다. */
export function useMouseDragScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number; moved: boolean; snapType: string; scrollBehavior: string } | null>(null);
  const suppressClickRef = useRef(false);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (!el || e.pointerType !== 'mouse' || e.button !== 0) return;
    suppressClickRef.current = false;
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startScrollLeft: el.scrollLeft, moved: false, snapType: el.style.scrollSnapType, scrollBehavior: el.style.scrollBehavior };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    const drag = dragRef.current;
    if (!el || !drag || e.pointerId !== drag.pointerId) return;
    const distance = e.clientX - drag.startX;
    if (!drag.moved) {
      if (Math.abs(distance) < 8) return;
      drag.moved = true;
      suppressClickRef.current = true;
      el.setPointerCapture(e.pointerId);
      el.style.scrollSnapType = 'none';
      el.style.scrollBehavior = 'auto';
    }
    e.preventDefault();
    el.scrollLeft = drag.startScrollLeft - distance;
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    const drag = dragRef.current;
    if (!el || !drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (drag.moved) {
      el.style.scrollSnapType = drag.snapType;
      el.style.scrollBehavior = drag.scrollBehavior;
    }
  }

  return { scrollRef, dragHandlers: {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
    onPointerLeave: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragRef.current?.moved) handlePointerUp(event);
    },
    onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onDragStart: (event: DragEvent<HTMLDivElement>) => event.preventDefault(),
  } };
}
