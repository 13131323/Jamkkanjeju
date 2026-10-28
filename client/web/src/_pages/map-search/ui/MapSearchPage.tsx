'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentAddress, useCurrentCoords, useDisplayLocation } from '@entities/location';
import { useRecentSearches, useSearchPlaces } from '@features/map-search';
import type { Coordinates } from '@shared/config/geo';
import type { SearchResultPlace } from '@features/map-search';

const SEARCH_KEYWORD_MAX_LENGTH = 50;

export function MapSearchPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const { coords } = useDisplayLocation();
  // 주소 라벨은 지도 표시용 coords(제주 밖이면 null)가 아니라 실제 현재 좌표 기준으로 뽑는다 — 제주 밖에서도 주소는 보여줘야 한다.
  const currentCoords = useCurrentCoords();
  const { data: address } = useCurrentAddress(currentCoords, true);
  const searchResult = useSearchPlaces(keyword, coords);
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
      <button
        type="button"
        aria-label="뒤로가기"
        onClick={() => router.back()}
        className="bg-warm-neutral-50 absolute left-5 z-10 flex h-8 w-8 items-center justify-center rounded-full"
        style={{ top: `calc(var(--safe-area-top) + 58px)` }}
      >
        <ChevronLeftIcon />
      </button>

      <div
        className="border-cool-neutral-200 bg-cool-neutral-white absolute right-4 left-4 z-10 flex h-10 items-center gap-2 rounded-full border px-3.5"
        style={{ top: `calc(var(--safe-area-top) + 108px)` }}
      >
        <SearchIcon />
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value.slice(0, SEARCH_KEYWORD_MAX_LENGTH))}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          maxLength={SEARCH_KEYWORD_MAX_LENGTH}
          placeholder="장소, 미션, 콘텐츠 검색"
          className="text-label-md text-warm-neutral-900 placeholder:text-warm-neutral-300 min-w-0 flex-1 bg-transparent font-medium outline-none"
        />
      </div>

      {/* 화면 끝까지 내려오는 스크롤 영역 — 마지막 항목이 안전영역에 가리지 않게 아래를 띄운다.
          앱 WebView에서는 하단 inset을 앱 루트 레이아웃이 처리하므로 0이다 */}
      <div
        className="bg-cool-neutral-white absolute inset-x-0 bottom-0 overflow-y-auto px-5"
        style={{ top: `calc(var(--safe-area-top) + 173px)`, paddingBottom: `var(--safe-area-bottom)` }}
      >
        {showRecent ? (
          <RecentSearchSection keywords={recentKeywords} onSelect={handleSelectRecentKeyword} />
        ) : (
          <SearchResultSections coords={coords} addressLabel={address} query={searchResult} onSelectPlace={handleSelectPlace} />
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
  data?: { recommended: SearchResultPlace[]; mission: SearchResultPlace[] };
  isLoading: boolean;
  isError: boolean;
};

function SearchResultSections({
  coords,
  addressLabel,
  query,
  onSelectPlace,
}: {
  coords: Coordinates | null;
  addressLabel: string | undefined;
  query: SearchQueryResult;
  onSelectPlace: (place: SearchResultPlace) => void;
}) {
  if (!coords) {
    return <p className="text-label-md text-warm-neutral-300 pt-10 text-center">위치 정보를 확인할 수 없어요</p>;
  }
  if (query.isLoading) {
    return <p className="text-label-md text-warm-neutral-300 pt-10 text-center">검색 중...</p>;
  }
  if (query.isError) {
    return <p className="text-label-md text-warm-neutral-300 pt-10 text-center">검색에 실패했어요. 다시 시도해주세요</p>;
  }

  const { recommended = [], mission = [] } = query.data ?? {};

  if (recommended.length === 0 && mission.length === 0) {
    return <p className="text-label-md text-warm-neutral-300 pt-10 text-center">검색 결과가 없어요</p>;
  }

  return (
    <>
      {recommended.length > 0 && (
        <section>
          <h2 className="text-heading-h4 text-warm-neutral-900 font-bold">{addressLabel ? `${addressLabel} 추천장소` : '추천장소'}</h2>
          <div className="flex flex-col">
            {recommended.map((item, index) => (
              <ResultListItem key={item.id} item={item} noDivider={index === recommended.length - 1} onClick={() => onSelectPlace(item)} />
            ))}
          </div>
        </section>
      )}
      {mission.length > 0 && (
        <section className={recommended.length > 0 ? 'mt-[50px]' : ''}>
          <h2 className="text-heading-h4 text-warm-neutral-900 font-bold">참여할 수 있는 미션이 있는 지역</h2>
          <div className="flex flex-col">
            {mission.map((item, index) => (
              <ResultListItem key={item.id} item={item} noDivider={index === mission.length - 1} onClick={() => onSelectPlace(item)} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ResultListItem({ item, noDivider, onClick }: { item: SearchResultPlace; noDivider: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex h-[76px] w-full items-center gap-3 text-left ${noDivider ? '' : 'border-cool-neutral-100 border-b'}`}>
      {item.representativeImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.representativeImageUrl} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="bg-warm-neutral-200 h-12 w-12 shrink-0 rounded-md" />
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-label-md text-warm-neutral-900 truncate font-medium">{item.name}</span>
        <span className="bg-warm-neutral-50 text-label-sm text-warm-neutral-600 w-fit rounded-sm px-2 py-0.5 whitespace-nowrap">{item.categoryLabel}</span>
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
