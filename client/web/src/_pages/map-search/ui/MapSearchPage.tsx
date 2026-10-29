'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentCoords } from '@entities/location';
import { useRecentSearches, useSearchPlaces } from '@features/map-search';
import type { Coordinates } from '@shared/config/geo';
import type { SearchResultPlace } from '@features/map-search';
import { SkeletonImage } from '@shared/ui/SkeletonImage';
import { SearchResultsSkeleton } from './SearchResultsSkeleton';

const SEARCH_KEYWORD_MAX_LENGTH = 50;

export function MapSearchPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  // 지도 표시용(useDisplayLocation)이 아니라 실제 현재 좌표를 쓴다 — 제주 밖에서도 검색·주소는 동작해야 한다
  // (useHomeData가 같은 이유로 useCurrentCoords를 쓰는 것과 동일한 근거, entities/location/model/useCurrentCoords.ts 주석 참고).
  const coords = useCurrentCoords();
  const searchResult = useSearchPlaces(keyword, coords, isComposing);
  const { keywords: recentKeywords, addRecentSearch } = useRecentSearches();

  function handleSelectPlace(place: SearchResultPlace) {
    addRecentSearch(keyword);
    router.push(`/map/${place.id}`);
  }

  function handleSelectRecentKeyword(recentKeyword: string) {
    setKeyword(recentKeyword);
    setIsFocused(false);
  }

  const showRecent = isFocused && keyword.trim() === '';

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {/* 이 화면의 상단 좌표는 상태바를 포함한 디자인 캔버스 기준(뒤로가기 58 / 검색바 108 / 목록 173)이라
          거기에 --safe-area-top을 더하면 상태바 54px이 두 번 먹어 헤더부터 통째로 내려간다.
          지도 화면(MapView)처럼 상태바 아래를 0으로 보는 값으로 맞춰야 검색바가 제자리에 멈춘다. */}
      <button
        type="button"
        aria-label="뒤로가기"
        onClick={() => router.back()}
        className="bg-warm-neutral-50 absolute left-5 z-10 flex h-8 w-8 items-center justify-center rounded-full"
        style={{ top: `calc(var(--safe-area-top) + 12px)` }}
      >
        <ChevronLeftIcon />
      </button>

      {/* 지도 화면 검색 버튼(MapView)과 위치·간격이 모두 같아야 한다 — top은 calc(var(--safe-area-top) + 54px),
          아이콘과 글자 사이는 gap-2.5. 예전에는 여기만 gap-2라 전환 순간 글자가 2px 흔들렸다. */}
      <div
        className="border-cool-neutral-200 bg-cool-neutral-white absolute right-4 left-4 z-10 flex h-10 items-center gap-2.5 rounded-full border px-3.5"
        style={{ top: `calc(var(--safe-area-top) + 54px)` }}
      >
        <SearchIcon />
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value.slice(0, SEARCH_KEYWORD_MAX_LENGTH))}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          maxLength={SEARCH_KEYWORD_MAX_LENGTH}
          placeholder="장소, 미션, 콘텐츠 검색"
          className="text-label-md text-warm-neutral-900 placeholder:text-warm-neutral-300 min-w-0 flex-1 bg-transparent font-medium outline-none"
        />
      </div>

      {/* 화면 끝까지 내려오는 스크롤 영역 — 마지막 항목이 안전영역에 가리지 않게 아래를 띄운다.
          앱 WebView에서는 하단 inset을 앱 루트 레이아웃이 처리하므로 0이다 */}
      <div className="bg-cool-neutral-white absolute inset-x-0 bottom-0 overflow-y-auto px-5" style={{ top: `calc(var(--safe-area-top) + 119px)`, paddingBottom: `var(--safe-area-bottom)` }}>
        {showRecent ? (
          <RecentSearchSection keywords={recentKeywords} onSelect={handleSelectRecentKeyword} />
        ) : (
          <SearchResultSections coords={coords} query={searchResult} onSelectPlace={handleSelectPlace} />
        )}
      </div>
    </div>
  );
}

function RecentSearchSection({ keywords, onSelect }: { keywords: string[]; onSelect: (keyword: string) => void }) {
  if (keywords.length === 0) {
    return <p className="text-label-md text-warm-neutral-300 pt-10 text-center">최근 검색 기록이 없어요</p>;
  }

  return (
    <section className="pt-5">
      <h2 className="text-heading-h4 text-warm-neutral-900 font-bold">최근 검색어</h2>
      <div className="flex flex-col">
        {keywords.map((recentKeyword) => (
          <button
            key={recentKeyword}
            type="button"
            // 버튼 클릭보다 input의 onBlur가 먼저 발생해 이 목록이 사라져버리는 걸 막기 위해 mousedown에서 포커스 이동을 막는다.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(recentKeyword)}
            className="border-cool-neutral-100 text-label-md text-warm-neutral-900 flex h-11 w-full items-center border-b text-left font-medium"
          >
            {recentKeyword}
          </button>
        ))}
      </div>
    </section>
  );
}

type SearchQueryResult = {
  data?: { locations: SearchResultPlace[] };
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
  isLoading: boolean;
  isError: boolean;
};

function SearchResultSections({
  coords,
  query,
  onSelectPlace,
}: {
  coords: Coordinates | null;
  query: SearchQueryResult;
  onSelectPlace: (place: SearchResultPlace) => void;
}) {
  if (!coords) {
    return <p className="text-label-md text-warm-neutral-300 pt-10 text-center">위치 정보를 확인할 수 없어요</p>;
  }
  if (query.isLoading) {
    return <SearchResultsSkeleton />;
  }
  if (query.isError && !query.data) {
    return <p className="text-label-md text-warm-neutral-300 pt-10 text-center">검색에 실패했어요. 다시 시도해주세요</p>;
  }

  const { locations = [] } = query.data ?? {};

  if (locations.length === 0) {
    return <p className="text-label-md text-warm-neutral-300 pt-10 text-center">검색 결과가 없어요</p>;
  }

  return (
    <section>
      <h2 className="text-heading-h4 text-warm-neutral-900 font-bold">검색 결과</h2>
      <div className="flex flex-col">
        {locations.map((item, index) => (
          <ResultListItem key={item.id} item={item} noDivider={index === locations.length - 1} onClick={() => onSelectPlace(item)} />
        ))}
      </div>
      {query.hasNextPage && (
        <button type="button" disabled={query.isFetchingNextPage} onClick={() => { void query.fetchNextPage(); }} className="text-label-md text-warm-neutral-600 w-full py-4">
          {query.isFetchingNextPage ? '불러오는 중...' : '더보기'}
        </button>
      )}
    </section>
  );
}

function ResultListItem({ item, noDivider, onClick }: { item: SearchResultPlace; noDivider: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex h-[76px] w-full items-center gap-3 text-left ${noDivider ? '' : 'border-cool-neutral-100 border-b'}`}>
      {item.representativeImageUrl ? (
        <SkeletonImage src={item.representativeImageUrl} className="h-12 w-12 shrink-0 rounded-md" />
      ) : (
        <div className="bg-warm-neutral-200 h-12 w-12 shrink-0 rounded-md" />
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-label-md text-warm-neutral-900 truncate font-medium">{item.name}</span>
        <div className="flex min-w-0 gap-1">
          <span className="bg-warm-neutral-50 text-label-sm text-warm-neutral-600 shrink-0 rounded-sm px-2 py-0.5 whitespace-nowrap">{item.categoryLabel}</span>
          {item.mission && <span title={item.mission.missionTitle} className="bg-tertiary-100 text-label-sm text-tertiary-800 truncate rounded-sm px-2 py-0.5">{item.mission.missionType === 'TREASURE' ? '보물찾기' : '협동미션'} · {item.mission.missionTitle}</span>}
        </div>
      </div>
      <span className="text-label-md text-warm-neutral-600 ml-auto shrink-0 font-normal">{item.distanceLabel}</span>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" className="text-warm-neutral-300" />
      <path d="M16 16l-3.2-3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-warm-neutral-300" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12.5 5 7.5 10l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-warm-neutral-900" />
    </svg>
  );
}
