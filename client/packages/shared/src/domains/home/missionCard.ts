/**
 * GET /api/v1/users/me/home 응답 → 홈 미션 카드.
 *
 * 서버 값에서 화면이 그대로 쓸 수 있는 형태를 만든다. 카드 문구(설명)와 아이콘은
 * 서버가 주지 않는 디자인 값이라 web이 route로 매핑해 붙인다.
 */
import type { AppHomeSchemasMissionType } from '../../api/generated/appHomeSchemasMissionType';

/** 화면·브릿지에서 쓰는 미션 라우트 값 */
export type MissionRoute = 'culture' | 'treasure' | 'coop';

export const MISSION_ROUTE_BY_TYPE: Record<AppHomeSchemasMissionType, MissionRoute> = {
  CULTURE: 'culture',
  TREASURE: 'treasure',
  COOPERATIVE: 'coop',
};

/** 1km 미만은 m, 그 이상은 소수 한 자리 km. 값이 없으면 null(거리 배지를 숨긴다) */
export function formatDistanceLabel(distanceMeter: number | null | undefined): string | null {
  // 0m는 유효한 거리다 — falsy 검사를 쓰면 "바로 여기"가 값 없음으로 묻힌다.
  if (distanceMeter === null || distanceMeter === undefined) return null;

  if (distanceMeter < 1000) return `${Math.round(distanceMeter)}m`;
  return `${(distanceMeter / 1000).toFixed(1)}km`;
}

export interface HomeMissionCard {
  /** React key. missionId는 유형별 테이블의 id라 유형이 다르면 값이 겹친다 */
  key: string;
  missionId: number;
  route: MissionRoute;
  title: string;
  /** 장소가 없는 미션이면 null */
  placeLabel: string | null;
  distanceLabel: string | null;
  durationMinutes: number | null;
}

/** toHomeMissionCards가 필요로 하는 최소 형태 — RecommendedMission이 이 모양을 만족한다 */
interface RecommendedMissionLike {
  missionId: number;
  missionType: AppHomeSchemasMissionType;
  missionTitle: string;
  locationTitle?: string | null;
  distanceMeter?: number | null;
  durationMinutes?: number | null;
}

export function toHomeMissionCards(missionRecommend: RecommendedMissionLike[]): HomeMissionCard[] {
  return missionRecommend.map((mission) => ({
    key: `${mission.missionType}-${mission.missionId}`,
    missionId: mission.missionId,
    route: MISSION_ROUTE_BY_TYPE[mission.missionType],
    title: mission.missionTitle,
    placeLabel: mission.locationTitle ?? null,
    distanceLabel: formatDistanceLabel(mission.distanceMeter),
    durationMinutes: mission.durationMinutes ?? null,
  }));
}
