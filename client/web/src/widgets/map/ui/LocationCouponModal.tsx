'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Coordinates } from '@shared/config/geo';
import { useSheetDragToClose } from '../model/useSheetDrag';
import { PlaceModalCard } from './PlaceModalCard';
import { MissionModalCard } from './MissionModalCard';
import { CouponModalCard, type CouponModalPayload } from './CouponModalCard';

type Props = { locationId: number; hasMission: boolean; coupon?: CouponModalPayload; markerImageUrl?: string | null; coords: Coordinates | null; onClose: () => void };

/** 장소 → 미션 → 쿠폰 순서로 존재하는 페이지만 가로 스와이프로 전환한다. */
export function LocationCouponModal({ locationId, hasMission, coupon, markerImageUrl, coords, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; left: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const labels = ['장소', ...(hasMission ? ['미션'] : []), ...(coupon ? ['쿠폰'] : [])];
  const { dragY, isDragging, dragHandlers } = useSheetDragToClose(onClose);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function goTo(index: number) {
    const element = scrollRef.current;
    if (element) element.scrollTo({ left: index * element.clientWidth, behavior: 'smooth' });
  }
  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    start.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, dragging: false };
    suppressClick.current = false;
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = start.current;
    if (!state) return;
    const dx = event.clientX - state.x;
    if (!state.dragging && (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(event.clientY - state.y))) return;
    state.dragging = true;
    event.currentTarget.style.scrollSnapType = 'none';
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.scrollLeft = state.left - dx;
  }
  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (start.current?.dragging) {
      event.stopPropagation();
      suppressClick.current = true;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      const index = Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth);
      event.currentTarget.style.scrollSnapType = 'x mandatory';
      goTo(index);
    }
    start.current = null;
  }

  return (
    <div
      className={`bg-cool-neutral-white absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-xl shadow-[4px_4px_14px_rgba(0,0,0,0.12)] ${isDragging ? '' : 'transition-transform duration-300 ease-out'}`}
      style={{ height: 'min(520px, 70dvh)', transform: visible ? `translateY(${dragY}px)` : 'translateY(100%)' }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex shrink-0 justify-center py-3" style={{ touchAction: 'none' }} {...dragHandlers}>
        <div className="bg-warm-neutral-100 h-1 w-10 rounded-full" />
      </div>
      <div className="border-cool-neutral-100 flex shrink-0 border-b px-4" role="group" aria-label="장소 모달 페이지">
        {labels.map((label, index) => (
          <button key={label} type="button" onClick={() => goTo(index)} aria-pressed={active === index} className={`flex-1 border-b-2 py-2 text-sm font-semibold ${active === index ? 'border-tertiary-800 text-tertiary-800' : 'text-warm-neutral-400 border-transparent'}`}>
            {label}
          </button>
        ))}
      </div>
      <div
        ref={scrollRef}
        className="scrollbar-none flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: 'pan-y' }}
        onScroll={(event) => setActive(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}
        onPointerDownCapture={pointerDown} onPointerMoveCapture={pointerMove} onPointerUpCapture={pointerUp} onPointerCancel={pointerUp}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
      >
        <div className="h-full min-w-0 shrink-0 basis-full snap-center overflow-hidden" aria-label="장소 정보">
          <PlaceModalCard locationId={locationId} markerImageUrl={coupon?.locationImageUrl ?? markerImageUrl ?? null} coords={coords} onClose={onClose} embedded />
        </div>
        {hasMission && (
          <div className="h-full min-w-0 shrink-0 basis-full snap-center overflow-hidden" aria-label="미션 정보">
            <MissionModalCard locationId={locationId} markerImageUrl={coupon?.locationImageUrl ?? markerImageUrl ?? null} coords={coords} onClose={onClose} embedded />
          </div>
        )}
        {coupon && (
          <div className="h-full min-w-0 shrink-0 basis-full snap-center overflow-hidden" aria-label="쿠폰 정보">
            <CouponModalCard {...coupon} isCollapsed={false} onCollapse={onClose} onExpand={() => undefined} embedded />
          </div>
        )}
      </div>
    </div>
  );
}
