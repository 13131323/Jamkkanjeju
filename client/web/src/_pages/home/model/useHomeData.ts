'use client';

import { useMemo } from 'react';
import { isAxiosError } from 'axios';
import { toHomeMissionCards, type HomeMissionCard } from '@packages/shared';
import type { GeneratedApi } from '@packages/shared';
import { useCurrentCoords } from '@entities/location';
import { useGetHomeApiV1UsersMeHomeGet } from '@/services/api/home/home';
import { resolveHomeQueryCoords } from './homeQueryCoords';
import { selectVisibleProgressMissions } from './progressMissions';

export interface HomeDataResult {
  missionCards: HomeMissionCard[];
  /** 진행중인 미션. 계약상 진행중일 수 없는 값은 걸러진 상태다(selectVisibleProgressMissions) */
  progressMissions: GeneratedApi.ProgressMission[];
  guestbookCount: number;
  characterImgUrl: string | null;
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

/**
 * GET /api/v1/users/me/home 응답 전체 — 홈 화면의 추천 미션 캐러셀·진행중 미션 카드·주소 아이콘 옆 방명록 뱃지·
 * 사용자 캐릭터 이미지가 모두 이 한 번의 조회를 공유한다(같은 queryKey라 TanStack Query가 캐시를 공유한다).
 *
 * 좌표는 **실제 현재 위치**를 query로 싣는다(useCurrentCoords). 제주 밖이면 서버가 근처 추천을
 * 못 찾아 추천 미션이 비는 것이 정상이다. 심사위원용 모드가 켜져 있을 때만 제주시청 고정 좌표가
 * 실린다 — 그 치환은 useCurrentCoords 안에서 일어난다. 아직 좌표를 모를 때만 섬 중심으로
 * 대체하는 이유는 resolveHomeQueryCoords 주석에 있다.
 *
 * 토큰은 앱 WebView가 문서 실행 전에 심어준다(shared/api/auth/webViewToken.ts).
 * 일반 브라우저로 열면 토큰이 없어 401이 나고 isError가 된다.
 */
export function useHomeData(): HomeDataResult {
  const currentCoords = useCurrentCoords();
  const center = resolveHomeQueryCoords(currentCoords);

  const { data, isPending, isError, refetch } = useGetHomeApiV1UsersMeHomeGet(
    { latitude: center.lat, longitude: center.lng },
    {
      query: {
        // queryClient의 전역 기본값이 throwOnError: true라, 조회가 실패하면 그대로
        // Sentry.ErrorBoundary까지 올라가 홈 전체가 "오류가 발생했습니다."로 바뀐다.
        // 홈 화면 각 섹션은 없으면 자리를 비우거나 mock 문구로 폴백하면 되는 영역이라 여기서만 끈다.
        throwOnError: false,
        retry: shouldRetryHome,
      },
    },
  );

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
    isPending,
    isError,
    refetch,
  };
}
