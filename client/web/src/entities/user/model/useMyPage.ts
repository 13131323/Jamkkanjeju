'use client';

import { useQuery } from '@tanstack/react-query';
import { getMyPage, MY_PAGE_QUERY_KEY } from '@shared/api/myPage';

/** 마이페이지 요약·진행 목록·캐릭터 상세가 동일한 v2 조회 캐시를 사용한다. */
export function useMyPage() {
  return useQuery({
    queryKey: MY_PAGE_QUERY_KEY,
    queryFn: ({ signal }) => getMyPage(signal),
    throwOnError: false,
  });
}
