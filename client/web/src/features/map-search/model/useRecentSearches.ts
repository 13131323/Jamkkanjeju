'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_RECENT_SEARCHES = 10;

type RecentSearchesState = {
  keywords: string[];
  addRecentSearch: (keyword: string) => void;
};

// 검색 결과를 탭해 실제로 이동한 키워드만 최근 검색어로 남긴다(타이핑 중간값은 저장 안 함). localStorage에 영속화.
export const useRecentSearches = create<RecentSearchesState>()(
  persist(
    (set) => ({
      keywords: [],
      addRecentSearch: (keyword) => {
        const trimmed = keyword.trim();
        if (!trimmed) return;

        set((state) => {
          const withoutDuplicate = state.keywords.filter((k) => k !== trimmed);
          return { keywords: [trimmed, ...withoutDuplicate].slice(0, MAX_RECENT_SEARCHES) };
        });
      },
    }),
    { name: 'map-search-recent-keywords' },
  ),
);
