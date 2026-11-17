'use client';

import { useMemo } from 'react';
import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { toHomeMissionCards, type HomeMissionCard } from '@packages/shared';
import type { GeneratedApi } from '@packages/shared';
import { useCurrentCoords } from '@entities/location';
import { orvalClient } from '@shared/api/axios/instance';
import type { HomeMaintenance, HomeResponse } from '@shared/api/home';
import { resolveHomeQueryCoords } from './homeQueryCoords';
import { selectVisibleProgressMissions } from './progressMissions';

export interface HomeDataResult {
  missionCards: HomeMissionCard[];
  /** 진행중인 미션. 계약상 진행중일 수 없는 값은 걸러진 상태다(selectVisibleProgressMissions) */
  progressMissions: GeneratedApi.ProgressMission[];
  guestbookCount: number;
  characterImgUrl: string | null;
  maintenance: HomeMaintenance | null;
  isPending: boolean;
  isError: boolean;
  /** 조회 실패 표시의 "다시 시도"가 쓴다 */
  refetch: () => void;
}

/** 재시도 상한. 일시적인 네트워크 실패만 만회하면 되므로 짧게 둔다 */
const MAX_RETRY = 2;

/**
 * 4xx는 다시 불러도 같은 답이 온다(토큰 없음·잘못된 좌표). 서버 오류·네트워크 실패만 재시도한다.
 *
 * orval이 TError를 ErrorResponse로 선언하지만 실제로 거부되는 값은 AxiosError다.
 */
function shouldRetryHome(failureCount: number, error: unknown): boolean {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status !== undefined && status >= 400 && status < 500) return false;
  return failureCount < MAX_RETRY;
}

export function useHomeData(): HomeDataResult {
  const currentCoords = useCurrentCoords();
  const center = resolveHomeQueryCoords(currentCoords);

  // 다른 API의 v1 생성 코드는 유지하고 홈 조회만 Spring v2 계약으로 연결한다.
  const params = { latitude: center.lat, longitude: center.lng };
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['/api/v2/users/me/home', params],
    queryFn: ({ signal }) =>
      orvalClient<HomeResponse>({
        url: '/api/v2/users/me/home',
        method: 'GET',
        params,
        signal,
      }),
    // 조회 실패는 홈 화면 각 섹션에서 처리하고 일시적인 오류의 재시도 기준은 유지한다.
    throwOnError: false,
    retry: shouldRetryHome,
  });

  const missionCards = useMemo(() => toHomeMissionCards(data?.missionRecommend ?? []), [data]);

  // 응답에 상태 필드가 없어 "완료된 미션 빼기"는 서버 몫이다. 여기서는 계약상 진행중일 수 없는
  // 값만 걷어낸다 — 이유와 유형별 단계 의미는 selectVisibleProgressMissions 주석에 있다.
  // useMemo로 감싸는 이유는 계산 비용이 아니라 참조 안정성이다(카드 캐러셀이 배열을 effect 의존성으로 본다).
  const progressMissions = useMemo(() => selectVisibleProgressMissions(data?.progressMission ?? []), [data]);

  return {
    missionCards,
    progressMissions,
    guestbookCount: data?.guestbookCount ?? 0,
    characterImgUrl: data?.characterImgUrl ?? null,
    maintenance: data?.maintenance ?? null,
    isPending,
    isError,
    refetch,
  };
}
