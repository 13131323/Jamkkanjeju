import { JUDGE_MODE_COORDS } from '@packages/shared';
import { create } from 'zustand';

/**
 * 심사위원용 모드 — 제주 밖에서도 앱 전체를 제주에 있는 것처럼 보이게 하는 스위치.
 *
 * **web이 주인이다.** 켜고 끄는 UI(홈 단축 버튼 행의 "모드변경" + 코드 입력)와 저장은 web에
 * 있고, 앱은 JUDGE_MODE_UPDATE로 받은 값을 메모리에만 든다 — 양쪽이 각자 저장하면 상태가
 * 갈라진다. 홈이 열릴 때마다 web이 현재 값을 보내고, 미션 화면은 전부 홈을 거치므로 이것으로
 * 충분하다.
 *
 * 이 플래그가 정하는 것은 세 가지다: 협동 미션 시뮬레이션(config/coopSimulation.ts),
 * 좌표 고정(아래 applyJudgeModePosition), 그리고 **API 호출의 주인**
 * (services/authHeader.ts — 모드가 켜지면 앱도 web과 같은 심사위원 토큰으로 부른다).
 * 셋을 한 플래그가 정하는 것이 중요하다. 예전에는 토큰만 web에 따로 있어서, 홈은 심사위원
 * 계정의 "진행중인 미션"을 보여 주는데 그 카드를 눌러 들어간 앱 화면은 다른 사용자로 호출했다.
 *
 * 예전 `EXPO_PUBLIC_FORCE_JEJU_LOCATION` env 플래그를 대체한다(빌드에 인라인돼 배포 후엔 못 켰다).
 */

interface JudgeModeStore {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useJudgeModeStore = create<JudgeModeStore>((set) => ({
  enabled: false,
  setEnabled: (enabled) => set({ enabled }),
}));

/** 훅 밖(브릿지 콜백, 구독 콜백 등)에서 쓰는 비반응형 조회 */
export function isJudgeModeEnabled(): boolean {
  return useJudgeModeStore.getState().enabled;
}

/**
 * 고정 좌표(제주시청)를 expo-location 이름으로 옮긴 것.
 *
 * **상수가 아니라 함수다.** 모듈 최상위에서 `JUDGE_MODE_COORDS.lat`을 읽으면
 * `Cannot read property 'lat' of undefined`로 죽는다 — Metro가 shared의 `export *`를
 * CommonJS로 옮기는 과정에서 이 모듈 평가 시점에 배럴이 아직 비어 있을 수 있다.
 * 호출 시점으로 미루면 그때는 항상 채워져 있다.
 */
export function judgeModePosition(): { latitude: number; longitude: number } {
  return { latitude: JUDGE_MODE_COORDS.lat, longitude: JUDGE_MODE_COORDS.lng };
}

/**
 * 심사위원용 모드가 켜져 있으면 제주시청 좌표로 바꿔 돌려준다.
 *
 * 실측 좌표가 들어오는 자리(위치 구독 콜백, 1회 측위)에서 한 번씩 통과시키면 그 아래 로직은
 * 모드를 몰라도 된다 — "제주에 있는 것으로 본다"가 이 모드의 정의이므로 판단이 갈릴 곳이 없다.
 */
export function applyJudgeModePosition<T extends { latitude: number; longitude: number }>(position: T): T {
  if (!isJudgeModeEnabled()) return position;
  return { ...position, ...judgeModePosition() };
}
