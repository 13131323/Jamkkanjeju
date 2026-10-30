'use client';

import { useMemo } from 'react';
import { MISSION_ROUTE_BY_TYPE } from '@packages/shared';
import type { GeneratedApi } from '@packages/shared';
import { sendToApp } from '@shared/lib/bridge/utils';
import { useMyPage } from '@entities/user';
import TreasureChestOpen from '@shared/lib/images/treasure-chest-open.png';
import JejuCelebrationImage3 from '@shared/lib/images/JejuCelebrationImage3.png';
import JejuCelebrationImage4 from '@shared/lib/images/JejuCelebrationImage4.png';

/**
 * 마이페이지 "진행중인 미션" 카드에 필요한 값.
 *
 * 서버 응답(`ProgressMissionResponse`)에는 그림이 없어서 유형별 번들 이미지를 여기서 붙인다.
 * 화면은 이 형태만 알면 되고, 서버가 이미지 URL을 주기 시작하면 이 파일만 고치면 된다.
 */
export interface MissionProgressCardData {
  /** 공통 미션 ID. 앱이 어떤 미션을 이어할지 정하는 데 쓴다 */
  missionId: number;
  missionType: GeneratedApi.AppMissionModelsMissionType;
  title: string;
  current: number;
  total: number;
  image: typeof TreasureChestOpen;
}

/**
 * 유형별 카드 그림.
 *
 * 목업이 쓰던 그림 그대로다 — 디자인이 유형마다 다른 그림을 쓰고 있고, 서버에는 그 필드가 없다.
 */
const MISSION_IMAGE: Record<GeneratedApi.AppMissionModelsMissionType, typeof TreasureChestOpen> = {
  TREASURE: TreasureChestOpen,
  CULTURE: JejuCelebrationImage4,
  COOPERATIVE: JejuCelebrationImage3,
};

/**
 * 앱 NAVIGATE 라우트는 `culture-mission` 형태다. 홈(HomePage.toNavigateRoute)과 같은 규칙이다 —
 * 두 화면이 같은 브릿지 메시지를 보내므로 접미사 규칙이 어긋나면 한쪽만 조용히 먹통이 된다.
 */
function toNavigateRoute(missionType: GeneratedApi.AppMissionModelsMissionType): 'culture-mission' | 'treasure-mission' | 'coop-mission' {
  return `${MISSION_ROUTE_BY_TYPE[missionType]}-mission`;
}

/**
 * 진행중인 미션을 **이어서** 연다.
 *
 * `resume: true`가 핵심이다. 이게 없으면 앱이 미션 홈(인트로)의 "미션 시작하기"를 보여 주는데,
 * 이미 하던 미션에는 맞지 않는 화면이다. 붙이면 앱이 하던 단계로 곧장 보낸다
 * (`app/src/utils/missionNavigateTarget.ts`).
 *
 * 앱 WebView 밖(일반 브라우저)에서는 `sendToApp`이 조용히 넘어간다 — 미션 화면 자체가 앱에만 있다.
 */
export function resumeMission(mission: MissionProgressCardData): void {
  sendToApp({
    type: 'NAVIGATE',
    payload: { route: toNavigateRoute(mission.missionType), missionId: mission.missionId, resume: true },
  });
}

/**
 * 마이페이지 조회에서 진행중인 미션만 꺼낸다.
 *
 * 같은 `GET /api/v2/users/me/mypage`를 프로필·통계 등 다른 조각도 쓰게 되면 queryKey가 같아
 * TanStack Query가 캐시를 공유한다(홈의 useHomeData와 같은 구조).
 */
export function useMissionProgress(): { missions: MissionProgressCardData[]; isPending: boolean } {
  const { data, isPending } = useMyPage();

  const missions = useMemo(
    () =>
      (data?.progressMissions ?? []).map((mission) => ({
        missionId: mission.missionId,
        missionType: mission.missionType,
        title: mission.missionTitle,
        current: mission.currentCount,
        total: mission.totalCount,
        image: MISSION_IMAGE[mission.missionType],
      })),
    [data],
  );

  return { missions, isPending };
}
