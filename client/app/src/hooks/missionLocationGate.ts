import type * as Location from 'expo-location';

/**
 * 위치 권한 상태로 정해지는 다음 행동.
 *
 * - granted: 미션을 진행한다
 * - ask-again: 아직 다시 물어볼 수 있다. 안내만 하고 머문다
 * - open-settings: 영구 거부라 앱 설정으로 보내는 것 외에 방법이 없다
 */
export type MissionLocationGate = 'granted' | 'ask-again' | 'open-settings';

/**
 * expo-location은 네이티브 모듈이라 vitest에서 값으로 import할 수 없다.
 * PermissionStatus.GRANTED의 실제 값이 이 문자열이므로 비교만 직접 한다.
 */
const GRANTED: Location.PermissionStatus = 'granted' as Location.PermissionStatus;

export function resolveMissionLocationGate(status: Location.PermissionStatus, canAskAgain: boolean): MissionLocationGate {
  if (status === GRANTED) return 'granted';
  return canAskAgain ? 'ask-again' : 'open-settings';
}

/**
 * 권한이 없을 때 보여줄 안내.
 *
 * 미션 종류와 무관하게 같은 문구를 쓴다 — 모든 미션이 위치를 기준으로 진행되고,
 * 허용하지 않으면 참여할 수 없다는 규칙이 동일하기 때문이다.
 */
export const MISSION_LOCATION_ALERT = {
  title: '위치 권한이 필요해요',
  message: '미션은 내 위치를 기준으로 진행돼요. 위치 권한을 허용해야 참여할 수 있어요.',
} as const;
