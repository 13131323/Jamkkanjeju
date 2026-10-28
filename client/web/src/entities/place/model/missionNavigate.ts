import { MISSION_ROUTE_BY_TYPE } from '@packages/shared';
import type { MapMissionType } from './types';

export type MissionNavigateRoute = 'culture-mission' | 'treasure-mission' | 'coop-mission';

export type MissionNavigatePayload = {
  route: MissionNavigateRoute;
  missionId: number;
};

/**
 * 미션 화면을 열어 달라고 앱에 보낼 payload.
 *
 * 미션 화면 자체가 앱에만 있어 web은 직접 라우팅할 수 없다. `missionId`는 **그 미션의 유형별 세부 id**라
 * 반드시 함께 보내야 한다 — 앱 인트로가 `GET /api/v1/missions/{missionType}/{missionId}`에 쓴다.
 * 근처 미션 카드는 저마다 다른 장소의 미션이라 이 값이 빠지면 열 대상을 특정할 수 없다.
 */
export function buildMissionNavigatePayload({ missionType, missionId }: { missionType: MapMissionType; missionId: number }): MissionNavigatePayload {
  return { route: `${MISSION_ROUTE_BY_TYPE[missionType]}-mission`, missionId };
}
