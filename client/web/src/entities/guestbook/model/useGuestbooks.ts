'use client';

import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { DEFAULT_GUESTBOOK_FILTERS, getGuestbooks, GUESTBOOKS_QUERY_KEY, type GuestbookFilters } from '@shared/api/guestbooks';

/** 선택한 페이지의 일반·길바닥 방명록을 각각 최대 10개씩 조회하며 이전 목록과 합치지 않는다. */
export function useGuestbooks(page = 0, filters: GuestbookFilters = DEFAULT_GUESTBOOK_FILTERS) {
  const params = { ...filters, generalPage: page, generalSize: 10, roadPage: page, roadSize: 10 };
  const query = useQuery({
    queryKey: [...GUESTBOOKS_QUERY_KEY, params],
    queryFn: ({ signal }) => getGuestbooks(params, signal),
    throwOnError: false,
    retry: (failureCount, error) => {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      return !(status !== undefined && status >= 400 && status < 500) && failureCount < 2;
    },
  });
  return { ...query, hasNextPage: (query.data?.generalGuestbooksPage.hasNext ?? false) || (query.data?.roadGuestbooksPage.hasNext ?? false) };
}
