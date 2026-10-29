'use client';

import { useRef, type PointerEvent as ReactPointerEvent, type DragEvent } from 'react';

/** 홈 배너와 이미지 목록의 마우스 가로 드래그를 처리하며 터치는 브라우저 기본 스크롤을 사용한다. */
export function useMouseDragScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startScrollLeft: number } | null>(null);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (!el || e.pointerType !== 'mouse') return;
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startScrollLeft: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
    el.style.scrollBehavior = 'auto';
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    const drag = dragRef.current;
    if (!el || !drag || e.pointerId !== drag.pointerId) return;
    el.scrollLeft = drag.startScrollLeft - (e.clientX - drag.startX);
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (!el || dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    // 잡아 둔 포인터는 반드시 놓는다 — 남겨 두면 같은 포인터를 쓰는 다른 곳(개발 오버레이 등)이 어긋난다.
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    el.style.scrollBehavior = '';
  }

  return { scrollRef, dragHandlers: {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
    onDragStart: (event: DragEvent<HTMLDivElement>) => event.preventDefault(),
  } };
}
