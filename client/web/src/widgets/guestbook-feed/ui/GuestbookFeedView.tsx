'use client';

import { useEffect, useRef, useState } from 'react';
import type { GuestbookSort, GuestbookTypeFilter } from '@shared/api/guestbooks';
import { pickScatterTransform } from '../model/decorativeStyle';
import { SORT_OPTION_LABEL } from '../model/sort';
import { useGuestbookFeed } from '../model/useGuestbookFeed';
import { GuestbookCard } from './GuestbookCard';
import { GuestbookDetailModal } from './GuestbookDetailModal';
import { GuestbookFeedSkeleton } from './GuestbookFeedSkeleton';
import { GuestbookPagination } from './GuestbookPagination';

const FEED_TITLE = '방명록';
const FEED_SUBTITLE = '여행자들이 남긴 흔적을 발견하세요';

const SORT_OPTIONS: GuestbookSort[] = ['LATEST', 'POPULAR', 'MINE', 'LIKED'];

function GuestbookHeader() {
  return (
    <div className="relative flex w-full flex-col gap-1 px-4 pb-3.5" style={{ paddingTop: `calc(var(--safe-area-top) + 16px)` }}>
      <h1 className="text-heading-h3 text-cool-neutral-white font-semibold">{FEED_TITLE}</h1>
      <p className="text-body-md text-cool-neutral-white">{FEED_SUBTITLE}</p>
    </div>
  );
}

function FilterChips({ guestbookType, onChange }: { guestbookType: GuestbookTypeFilter; onChange: (value: GuestbookTypeFilter) => void }) {
  const chips: { value: GuestbookTypeFilter; label: string }[] = [
    { value: 'ALL', label: '전체' },
    { value: 'GENERAL', label: '장소' },
    { value: 'ROAD', label: '자유' },
  ];

  return (
    <div className="flex w-full gap-2 px-4 pb-2">
      {chips.map((chip) => {
        const active = chip.value === guestbookType;
        return (
          <button key={chip.value} type="button" onClick={() => onChange(chip.value)} aria-pressed={active}
            className={`text-label-md shrink-0 rounded-full border px-4 py-1.5 font-medium ${
              active ? 'border-cool-neutral-white bg-cool-neutral-white text-cool-neutral-900' : 'border-cool-neutral-800 bg-cool-neutral-800 text-cool-neutral-white'
            }`}>
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

function SortBar({ sortOption, onChange }: { sortOption: GuestbookSort; onChange: (value: GuestbookSort) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    function closeOutside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  function closeMenu() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className="relative z-20 flex w-full items-center justify-end px-4 py-2">
      <div ref={containerRef} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }} onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); closeMenu(); }
      }}>
        <button ref={triggerRef} type="button" onClick={() => setOpen((old) => !old)}
          aria-haspopup="menu" aria-expanded={open} aria-controls="guestbook-sort-menu"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
          }} className="text-label-sm text-cool-neutral-white flex items-center gap-1">
          {SORT_OPTION_LABEL[sortOption]}
          <svg className={`h-[5px] w-2 ${open ? 'rotate-180' : ''}`} viewBox="0 0 8 5" fill="none" aria-hidden="true">
            <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open ? (
          <div ref={menuRef} id="guestbook-sort-menu" role="menu" aria-label="방명록 정렬 및 조회 기준"
            className="bg-cool-neutral-white border-cool-neutral-200 absolute top-full right-4 mt-1 w-44 rounded-xl border p-1.5 shadow-lg"
            onKeyDown={(event) => {
              if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
              const index = options.indexOf(document.activeElement as HTMLButtonElement);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
                : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
              options[next]?.focus();
            }}>
            {SORT_OPTIONS.map((option) => (
              <button key={option} type="button" role="menuitemradio" aria-checked={sortOption === option}
                className={`text-label-md text-cool-neutral-900 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-warm-neutral-100 focus-visible:bg-warm-neutral-100 ${sortOption === option ? 'bg-warm-neutral-100 font-bold' : ''}`}
                onClick={() => { onChange(option); closeMenu(); }}>
                <span className="w-3" aria-hidden="true">{sortOption === option ? '✓' : ''}</span>
                {SORT_OPTION_LABEL[option]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GuestbookFeed({ cards, onSelect }: { cards: ReturnType<typeof useGuestbookFeed>['cards']; onSelect: (id: string) => void }) {
  if (cards.length === 0) {
    return <p className="text-body-sm text-cool-neutral-white w-full px-4 py-12 text-center">아직 표시할 방명록이 없어요.</p>;
  }

  return (
    <div className="w-full columns-2 gap-3 px-4 pt-3 pb-8">
      {cards.map((card) => {
        const { rotateDeg, offsetX, offsetY, gapPx } = pickScatterTransform(card.id);
        return (
          // 화이트보드에 붙여놓은 듯한 느낌 — 회전+오프셋은 transform이라 masonry 컬럼 높이 계산에는 영향 없음.
          // margin-bottom도 카드마다 랜덤이라 세로 간격이 좁았다 넓었다 한다.
          <div
            key={card.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(card.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(card.id)}
            className="w-full cursor-pointer break-inside-avoid"
            style={{ transform: `rotate(${rotateDeg}deg) translate(${offsetX}px, ${offsetY}px)`, marginBottom: `${gapPx}px` }}
          >
            <GuestbookCard card={card} />
          </div>
        );
      })}
    </div>
  );
}

export function GuestbookFeedView({ initialGuestbookType = 'ALL' }: { initialGuestbookType?: GuestbookTypeFilter }) {
  const { isLoading, isError, cards, orderedGuestbooks, filters, changeFilters, page, maxKnownPage, setPage, hasNextPage, isFetching } =
    useGuestbookFeed(initialGuestbookType);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={feedRef} className="bg-cool-neutral-900 flex w-full flex-col">
      <GuestbookHeader />
      <FilterChips guestbookType={filters.guestbookType} onChange={(guestbookType) => { setSelectedId(null); changeFilters({ guestbookType }); }} />
      <SortBar sortOption={filters.sort} onChange={(sort) => { setSelectedId(null); changeFilters({ sort }); }} />
      {isLoading ? (
        <GuestbookFeedSkeleton />
      ) : isError ? (
        <p className="text-body-sm text-cool-neutral-white w-full px-4 py-12 text-center">방명록을 불러오지 못했어요. 다시 시도해주세요</p>
      ) : (
        <GuestbookFeed cards={cards} onSelect={setSelectedId} />
      )}
      <GuestbookPagination page={page} maxKnownPage={maxKnownPage} hasNextPage={hasNextPage} pending={isFetching} onChange={(next) => {
        setSelectedId(null);
        setPage(next);
        feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }} />
      {selectedId && orderedGuestbooks.some((record) => record.key === selectedId) ? <GuestbookDetailModal guestbooks={orderedGuestbooks} initialId={selectedId} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}
