import type { GeneratedApi } from '@packages/shared';

/** 브릿지 NAVIGATE가 쓰는 route 값 */
export type NavigateMissionRoute = 'culture-mission' | 'treasure-mission' | 'coop-mission';

/** intro가 `mission` 파라미터로 받는 값 */
export type MissionParam = 'culture' | 'treasure' | 'coop';

const MISSION_ROUTE_PARAM: Record<NavigateMissionRoute, MissionParam> = {
  'culture-mission': 'culture',
  'coop-mission': 'coop',
  'treasure-mission': 'treasure',
};

export interface MissionNavigateTarget
  extends Record<'pathname', '/mission/intro' | '/mission/culture' | '/mission/treasure' | '/mission/together'> {
  /** intro로 갈 때만 필요하다. 진행 화면은 경로 자체가 미션 종류를 정한다 */
  mission?: MissionParam;
}

/**
 * NAVIGATE 메시지를 어느 화면으로 보낼지 정한다.
 *
 * 기본은 인트로다. `resume`이 참일 때만(홈의 "진행중인 미션" 카드) 인트로를 건너뛰고 진행 화면으로
 * 보낸다 — 이미 시작한 미션에 "미션 시작하기"를 다시 보여주는 건 사용자에게 맞지 않는다.
 * 단계는 각 화면이 스스로 찾는다(culture는 resumed ref, treasure는 treasureProgress 스토어).
 *
 * 협동 미션도 **인트로로 보내지 않는다**(사용자 지시). 한때 보냈던 이유는 이어하기에도 방을 여는
 * 요청(`POST /api/v1/cooperative-missions/{cooperativeMissionId}/progress`)이 앞서야 하는데
 * 그 호출이 인트로의 "시작하기"에만 있었기 때문이다. 지금은 그 호출이 협동 흐름 자체로 옮겨 가서
 * (`hooks/useEnterCoopRoom.ts`, 초대 화면이 방이 없으면 스스로 연다) 인트로를 거칠 이유가 없다.
 *
 * 협동만 진행 화면이 셋이라 어느 단계인지는 그 응답의 `currentStep`이 정한다 —
 * **프론트는 currentStep을 기준으로 화면을 구성한다.** 그래서 목적지는 협동 미션의 첫 화면 하나로
 * 두고, 단계가 더 앞서 있으면 그 화면이 곧바로 해당 단계로 바꿔 끼운다.
 */
export function resolveMissionNavigateTarget(route: NavigateMissionRoute, resume?: boolean): MissionNavigateTarget {
  if (resume !== true) {
    return { pathname: '/mission/intro', mission: MISSION_ROUTE_PARAM[route] };
  }

  switch (route) {
    case 'culture-mission':
      return { pathname: '/mission/culture' };
    case 'treasure-mission':
      return { pathname: '/mission/treasure' };
    case 'coop-mission':
      return { pathname: '/mission/together' };
  }
}

/** 홈 응답의 미션 유형 → 브릿지 route. web이 보내는 값과 짝이 맞아야 한다 */
export const NAVIGATE_ROUTE_BY_MISSION_TYPE: Record<GeneratedApi.AppHomeSchemasMissionType, NavigateMissionRoute> = {
  CULTURE: 'culture-mission',
  TREASURE: 'treasure-mission',
  COOPERATIVE: 'coop-mission',
};
