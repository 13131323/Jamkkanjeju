import { JUDGE_MODE_COORDS } from '@packages/shared';
import type { Coordinates } from '@shared/config/geo';
import { isJudgeModeEnabled, useJudgeModeStore } from './judgeMode';

/**
 * 위치를 제주로 고정하는 모드.
 *
 * 제주 밖에서 실행하면 홈 상단 주소는 실제 위치가 나오고, 추천 미션 배너와 지도 마커는
 * resolveDisplayLocation이 좌표를 버려(제주 밖) 아무것도 뜨지 않는다. 개발 중 확인이 불가능하고,
 * 스토어 심사처럼 제주에 있을 수 없는 상황에서도 화면을 보여줄 수 없다.
 *
 * 켜는 길은 **심사위원용 모드 하나**다(judgeMode.ts) — 홈 단축 버튼 행의 "모드변경" 열쇠 아이콘을
 * 눌러 코드를 입력한다(features/judge-mode).
 *
 * `NEXT_PUBLIC_FORCE_JEJU_LOCATION` env 플래그를 지운 이유: 빌드 시점에 인라인되므로 이미
 * 넘어간 빌드에서는 켤 수 없고, 켜진 빌드에서는 토글로 끌 수도 없었다.
 */

/** 고정에 쓰는 좌표(제주시청). 앱도 같은 값을 봐야 해서 브릿지 계약과 함께 둔다 */
export const FORCED_JEJU_COORDS: Coordinates = JUDGE_MODE_COORDS;

/**
 * 켜져 있으면 고정 좌표, 아니면 null.
 *
 * **비반응형이다.** 렌더에 쓰는 곳은 `useForcedJejuCoords()`로 구독해야 토글이 반영된다.
 * 이 함수는 effect 안에서 한 번만 읽는 곳(useKakaoMap의 진입 중심, useLocationBridge 핸들러)용이다.
 */
export function forcedJejuCoords(): Coordinates | null {
  return isJudgeModeEnabled() ? FORCED_JEJU_COORDS : null;
}

/**
 * `forcedJejuCoords()`의 반응형 버전. 토글하면 곧바로 다시 렌더된다.
 *
 * 돌려주는 값은 모듈 상수 아니면 null이라 참조가 안정적이다 — useMemo 의존성에 그대로 넣어도 된다.
 */
export function useForcedJejuCoords(): Coordinates | null {
  const isJudgeMode = useJudgeModeStore((s) => s.enabled);
  return isJudgeMode ? FORCED_JEJU_COORDS : null;
}
