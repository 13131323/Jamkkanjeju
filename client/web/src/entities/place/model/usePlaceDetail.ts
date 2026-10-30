'use client';

import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type { Coordinates } from '@shared/config/geo';
import { getMapLocationDetail } from '@shared/api/mapLocationDetail';
import { toPlaceDetail } from './placeDetailTypes';

const HTTP_NOT_FOUND = 404;
/** 재시도 상한. 일시적인 네트워크 실패만 만회하면 되므로 짧게 둔다 */
const MAX_RETRY = 2;

// 좌표를 소수점 4자리(약 11m 단위)로 반올림해 쿼리키를 안정화 (entities/location의 useCurrentAddress와 동일한 방식)
function roundCoord(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * 4xx(없는 장소 404 포함)는 다시 불러도 같은 답이 온다(토큰 없음·잘못된 좌표). 서버 오류·네트워크 실패만 재시도한다
 * (_pages/home/model/useHomeData.ts와 같은 규칙).
 */
function shouldRetryPlaceDetail(failureCount: number, error: unknown): boolean {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status !== undefined && status >= 400 && status < 500) return false;
  return failureCount < MAX_RETRY;
}

export function usePlaceDetail(locationId: number, center: Coordinates) {
  const roundedCenter = { lat: roundCoord(center.lat), lng: roundCoord(center.lng) };

  const query = useInfiniteQuery({
    queryKey: ['/api/v2/map/locations', locationId, roundedCenter],
    queryFn: ({ pageParam, signal }) => getMapLocationDetail(locationId, {
      userLatitude: roundedCenter.lat, userLongitude: roundedCenter.lng, page: pageParam, size: 20,
    }, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.guestbooksPage.hasNext ? lastPage.guestbooksPage.page + 1 : undefined,
    enabled: Number.isInteger(locationId) && locationId > 0,
    // 오류 화면은 직접 처리하며 오류 메시지는 기존 공통 토스트를 사용한다.
    throwOnError: false,
    retry: shouldRetryPlaceDetail,
  });

  // 없는 장소(404)는 "찾을 수 없어요", 나머지 실패는 "불러오지 못했어요"로 화면에서 갈라야 한다.
  const isNotFound = isAxiosError(query.error) && query.error.response?.status === HTTP_NOT_FOUND;
  const data = useMemo(() => {
    if (!query.data) return undefined;
    const [firstPage] = query.data.pages;
    return toPlaceDetail({ ...firstPage, guestbooks: query.data.pages.flatMap((page) => page.guestbooks) });
  }, [query.data]);

  return { data, isLoading: query.isLoading, isNotFound, isError: query.isError && !isNotFound,
    hasNextPage: query.hasNextPage, isFetchingNextPage: query.isFetchingNextPage, fetchNextPage: query.fetchNextPage };
}
