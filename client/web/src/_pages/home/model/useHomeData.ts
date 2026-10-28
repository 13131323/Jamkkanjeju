'use client';

import { useMemo } from 'react';
import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { toHomeMissionCards, type HomeMissionCard } from '@packages/shared';
import type { GeneratedApi } from '@packages/shared';
import { useCurrentCoords, useIsJudgeModeHydrated } from '@entities/location';
import { orvalClient } from '@shared/api/axios/instance';
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
 * GET /api/v2/users/me/home 응답 전체 — 홈 화면의 추천 미션 캐러셀·진행중 미션 카드·주소 아이콘 옆 방명록 뱃지·
 * 사용자 캐릭터 이미지가 모두 이 한 번의 조회를 공유한다(같은 queryKey라 TanStack Query가 캐시를 공유한다).
 *
 * 좌표는 **실제 현재 위치**를 query로 싣는다(useCurrentCoords). 제주 밖이면 서버가 근처 추천을
 * 못 찾아 추천 미션이 비는 것이 정상이다. 심사위원용 모드가 켜져 있을 때만 제주시청 고정 좌표가
 * 실린다 — 그 치환은 useCurrentCoords 안에서 일어난다. 아직 좌표를 모를 때만 섬 중심으로
 * 대체하는 이유는 resolveHomeQueryCoords 주석에 있다.
 *
 * 현재는 인증 헤더 없이 요청하고 백엔드 개발용 자동 로그인으로 사용자를 식별한다.
 *
 * **심사위원용 모드 되살리기가 끝날 때까지 기다린다(`enabled: isHydrated`).** React는 자식
 * effect를 부모(Providers)보다 먼저 돌려서, 기다리지 않으면 이 조회가 항상 `enabled=false`
 * 기준으로 먼저 한 번 나간 뒤(쿼리 키 해시가 'app') 되살리기가 끝나자마자 'judge' 해시로
 * 다시 나간다 — 저장값이 켜짐이면 일반 계정 응답이 잠깐 화면에 걸렸다가 심사위원 계정 응답으로
 * 덮여 "깜빡이며 모드가 바뀌는" 것으로 보였다(entities/location/model/judgeMode.ts의
 * useJudgeModeHydration 주석). 기다리면 그 첫 번째 조회 자체가 사라진다.
 *
 * ---
 * **`placeholderData: keepPreviousData`를 일부러 쓰지 않는다.**
 *
 * 홈이 한 번 뜨는 동안 이 조회는 **두 번** 나갈 수 있다. 좌표를 아직 모르는 첫 렌더에서 섬
 * 중심으로 한 번(resolveHomeQueryCoords), 앱이 LOCATION_UPDATE로 실제 좌표를 밀어준 뒤 그
 * 좌표로 한 번이다. 두 번째는 queryKey가 달라 캐시가 없으므로 `isPending`으로 되돌아간다.
 *
 * keepPreviousData를 걸면 그 구간에 **직전 좌표(섬 중심)의 추천**이 사용자 화면에 남는다.
 * 그건 이 사용자 주변의 추천이 아니라서, 잠깐이라도 사실처럼 보이면 "잘못된 정보"로 읽힌다
 * (사용자 우려). 이 화면에서 옛 값이 막아 주는 것은 **레이아웃 시프트뿐인데**, 그건 값이 아니라
 * **자리 크기**의 문제라 고정 크기 스켈레톤으로 이미 해결돼 있다
 * (ui/HomePage.tsx의 MissionCarousel 스켈레톤 + IndicatorRowSpacer).
 * 값을 감춘 채 구조만 남길 거라면 keepPreviousData가 더 주는 것이 없으므로 넣지 않는다 —
 * 안 넣는 쪽이 "끝난 미션이 잠깐 보이는" 경로를 아예 만들지 않아 더 안전하다.
 */
export function useHomeData(): HomeDataResult {
  const currentCoords = useCurrentCoords();
  const center = resolveHomeQueryCoords(currentCoords);
  const isJudgeModeHydrated = useIsJudgeModeHydrated();

  // 다른 API의 v1 생성 코드는 유지하고 홈 조회만 Spring v2 계약으로 연결한다.
  const params = { latitude: center.lat, longitude: center.lng };
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['/api/v2/users/me/home', params],
    queryFn: ({ signal }) => orvalClient<GeneratedApi.HomeResponse>({
      url: '/api/v2/users/me/home',
      method: 'GET',
      params,
      signal,
    }),
    // 조회 실패는 홈 화면 각 섹션에서 처리하고 일시적인 오류의 재시도 기준은 유지한다.
    throwOnError: false,
    retry: shouldRetryHome,
    // 저장된 심사위원 모드와 고정 좌표를 복원한 뒤 요청한다.
    enabled: isJudgeModeHydrated,
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
    isPending,
    isError,
    refetch,
  };
}
