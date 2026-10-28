'use client';

import { useState } from 'react';
import { pickScatterTransform } from '../model/decorativeStyle';
import type { FeedFilterValue, LocationFilterValue } from '../model/filters';
import { SORT_OPTION_LABEL, type SortOption } from '../model/sort';
import { useGuestbookFeed } from '../model/useGuestbookFeed';
import { GuestbookCard } from './GuestbookCard';
import { GuestbookDetailModal } from './GuestbookDetailModal';

const FEED_TITLE = '방명록';
const FEED_SUBTITLE = '여행자들이 남긴 흔적을 발견하세요';

// 엽서는 탭에서 제거(카드 자체가 없어짐).
// 날씨는 카드 디자인은 없어졌지만 탭은 유지 — 클릭 시 날씨 데이터가 붙은 카드 전부를 보여준다(filters.ts 참고).
const CATEGORY_TABS: { value: FeedFilterValue; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'note', label: '✏️ 글' },
  { value: 'photo', label: '📷 사진' },
  { value: 'audio', label: '🎵 음악' },
  { value: 'weather', label: '🌤 날씨' },
];

const SORT_OPTIONS: SortOption[] = ['latest', 'visited'];

function isSameLocationFilter(a: LocationFilterValue, b: LocationFilterValue): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'location' && b.type === 'location') return a.locationTitle === b.locationTitle;
  return true;
}

function GuestbookHeader({ onlyMine, onToggleOnlyMine }: { onlyMine: boolean; onToggleOnlyMine: () => void }) {
  return (
    <div className="relative flex w-full flex-col gap-1 px-4 pb-3.5" style={{ paddingTop: `calc(var(--safe-area-top) + 16px)` }}>
      <button
        type="button"
        onClick={onToggleOnlyMine}
        aria-label="내가 작성한 방명록만 보기"
        aria-pressed={onlyMine}
        className="bg-cool-neutral-700 absolute right-4 flex h-9 w-9 items-center justify-center rounded-full"
        style={{ top: `calc(var(--safe-area-top) + 12px)` }}
      >
        <HeartIcon filled={onlyMine} />
      </button>
      <h1 className="text-heading-h3 text-cool-neutral-white font-semibold">{FEED_TITLE}</h1>
      <p className="text-body-md text-cool-neutral-white">{FEED_SUBTITLE}</p>
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? '#FF6B6B' : 'none'} stroke={filled ? '#FF6B6B' : '#ffffff'} strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-6.7-4.35-9.3-8.2C.6 9.7 1.4 6 4.6 4.7 7 3.7 9.4 4.6 12 7.3c2.6-2.7 5-3.6 7.4-2.6 3.2 1.3 4 5 1.9 8.1C18.7 16.65 12 21 12 21z" />
    </svg>
  );
}

function FilterChips({ locationOptions, locationFilter, onChange }: { locationOptions: string[]; locationFilter: LocationFilterValue; onChange: (value: LocationFilterValue) => void }) {
  const chips: { key: string; value: LocationFilterValue; label: string }[] = [
    { key: 'all', value: { type: 'all' }, label: '전체' },
    { key: 'road', value: { type: 'road' }, label: '자유' },
    ...locationOptions.map((locationTitle) => ({ key: `location-${locationTitle}`, value: { type: 'location' as const, locationTitle }, label: locationTitle })),
  ];

  return (
    <div className="flex w-full scrollbar-none gap-2 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {chips.map((chip) => {
        const active = isSameLocationFilter(chip.value, locationFilter);
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange(chip.value)}
            className={`text-label-md shrink-0 rounded-full border px-4 py-1.5 font-medium ${
              active ? 'border-cool-neutral-white bg-cool-neutral-white text-cool-neutral-900' : 'border-cool-neutral-800 bg-cool-neutral-800 text-cool-neutral-white'
            }`}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

function CategoryTabs({ cardTypeFilter, onChange }: { cardTypeFilter: FeedFilterValue; onChange: (value: FeedFilterValue) => void }) {
  return (
    <div
      className="border-cool-neutral-800 bg-cool-neutral-900 sticky z-10 flex w-full scrollbar-none gap-6 overflow-x-auto border-b px-4 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      style={{ top: `var(--safe-area-top)` }}
    >
      {CATEGORY_TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={`text-label-md text-cool-neutral-white shrink-0 border-b-2 py-2.5 ${tab.value === cardTypeFilter ? 'border-cool-neutral-white font-semibold' : 'border-transparent font-normal'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function SortBar({ sortOption, onChange }: { sortOption: SortOption; onChange: (value: SortOption) => void }) {
  function handleClick() {
    const currentIndex = SORT_OPTIONS.indexOf(sortOption);
    onChange(SORT_OPTIONS[(currentIndex + 1) % SORT_OPTIONS.length]);
  }

  return (
    <div className="flex w-full items-center justify-end gap-1 px-4 py-2">
      <button type="button" onClick={handleClick} className="text-label-sm text-cool-neutral-white flex items-center gap-1">
        {SORT_OPTION_LABEL[sortOption]}
        <svg className="h-[5px] w-2" viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M1 1L4 4L7 1" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
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

export function GuestbookFeedView() {
  const { isLoading, isError, cards, orderedGuestbooks, locationOptions, locationFilter, setLocationFilter, cardTypeFilter, setCardTypeFilter, sortOption, setSortOption, onlyMine, setOnlyMine } =
    useGuestbookFeed();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="bg-cool-neutral-900 flex w-full flex-col">
      <GuestbookHeader onlyMine={onlyMine} onToggleOnlyMine={() => setOnlyMine((prev) => !prev)} />
      <FilterChips locationOptions={locationOptions} locationFilter={locationFilter} onChange={setLocationFilter} />
      <CategoryTabs cardTypeFilter={cardTypeFilter} onChange={setCardTypeFilter} />
      <SortBar sortOption={sortOption} onChange={setSortOption} />
      {isLoading ? (
        <p className="text-body-sm text-cool-neutral-white w-full px-4 py-12 text-center">불러오는 중...</p>
      ) : isError ? (
        <p className="text-body-sm text-cool-neutral-white w-full px-4 py-12 text-center">방명록을 불러오지 못했어요. 다시 시도해주세요</p>
      ) : (
        <GuestbookFeed cards={cards} onSelect={setSelectedId} />
      )}
      {selectedId ? <GuestbookDetailModal guestbooks={orderedGuestbooks} initialId={selectedId} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}
