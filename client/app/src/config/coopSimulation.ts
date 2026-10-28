import { useJudgeModeStore } from '@/store/judgeMode';

/**
 * 협동 미션 시뮬레이션 스위치.
 *
 * 협동 미션은 기기 하나로 끝까지 볼 수 없다 — 팀원이 들어오고 역할이 배정되고 그 사람들이
 * 사진 인증을 마쳐야 다음 단계로 간다. 켜 두면 가짜 팀원 3명이 그 역할을 대신한다.
 *
 * 심사위원용 모드(store/judgeMode.ts)에 그대로 얹는다 — 둘 다 "제주 밖에서, 사람 여럿 없이
 * 화면을 확인한다"는 같은 상황을 위한 것이라 따로 켜고 끌 이유가 없다.
 */

/**
 * 시뮬레이션이 켜져 있는지. **렌더에서 쓰는 훅이다** — 심사위원용 모드는 실행 중에 바뀌므로
 * 구독해야 화면이 따라온다.
 */
export function useCoopSimulationEnabled(): boolean {
  return useJudgeModeStore((state) => state.enabled);
}
