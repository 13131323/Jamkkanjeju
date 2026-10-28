import { shouldAcceptPress } from './pressGate';

/**
 * 화면 전환 연타 차단 구간. **모든 화면·버튼이 공유한다.**
 *
 * useSinglePress(700ms)와 따로 두는 이유는 막아야 하는 대상이 다르기 때문이다.
 * - 같은 버튼 재탭: 정상적인 이유가 없어서 넉넉히 막아도 된다(700ms).
 * - 다른 버튼 탭: 뒤로 갔다가 바로 다음을 누르는 것처럼 정당한 경우가 있어서 짧아야 한다.
 *
 * 그래서 사람의 더블탭 간격(대개 100~300ms)만 덮는 값으로 잡는다. 화면 전환 애니메이션이
 * 없으므로(app/_layout.tsx animation: 'none') 이 구간이 애니메이션 길이를 덮을 필요는 없다.
 */
export const NAVIGATION_GATE_INTERVAL_MS = 400;

/**
 * 마지막으로 통과시킨 화면 전환 시각.
 *
 * 모듈 스코프인 게 핵심이다. 컴포넌트 ref로 두면 **첫 탭으로 새 화면이 마운트된 직후
 * 두 번째 탭이 새 화면의 버튼(= 다른 인스턴스, 빈 ref)에 꽂혀** 그대로 통과한다.
 * CTA가 화면마다 같은 자리(하단)에 있어서 실제로 이렇게 한 칸 더 넘어간다.
 */
let lastNavigatedAt: number | null = null;

/**
 * 화면 전환을 통과시킬지 판정하고, 통과시키면 시각을 기록한다.
 *
 * 판정과 기록을 한 함수에 묶은 이유: 호출부(navigate.ts)가 기록을 빠뜨리면
 * 게이트가 조용히 무력해진다.
 */
export function acceptNavigation(now: number, intervalMs: number = NAVIGATION_GATE_INTERVAL_MS): boolean {
  if (!shouldAcceptPress(lastNavigatedAt, now, intervalMs)) return false;

  lastNavigatedAt = now;
  return true;
}

/** 테스트에서 모듈 스코프 상태를 초기화한다. 앱 코드에서는 쓰지 않는다. */
export function resetNavigationGate(): void {
  lastNavigatedAt = null;
}
