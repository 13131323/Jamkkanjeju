/**
 * 연타(더블 클릭) 차단용 순수 판정 함수.
 *
 * 화면 이동 버튼을 빠르게 두 번 누르면 onPress가 두 번 실행되고, expo-router 스택에
 * 같은 화면이 두 장 쌓인다(뒤로가기를 두 번 눌러야 빠져나온다). 네비게이션이 실제로
 * 일어나 화면이 바뀌기까지는 수십 ms가 걸리고 그 사이 버튼은 계속 눌리는 상태라,
 * disabled 플래그만으로는 막히지 않는다. 그래서 "직전에 통과시킨 시각"을 기준으로
 * 일정 시간 안의 두 번째 입력을 버린다.
 *
 * 이 파일은 판정 규칙만 갖고 있고, 기준 시각을 어디에 담는지는 쓰는 쪽이 정한다.
 * - useSinglePress: 버튼 인스턴스별 ref (한 버튼의 재탭)
 * - navigationGate: 모듈 스코프 (화면을 넘나드는 연타 — 두 번째 탭은 다음 화면의 버튼에 꽂힌다)
 */

/**
 * 기본 차단 구간. **같은 버튼**을 다시 누르는 경우에만 쓴다(useSinglePress).
 *
 * 사람이 의도적으로 같은 버튼을 0.7초 안에 두 번 누르는 일은 없다 — 그 안에 들어온 두 번째 입력은
 * 손가락이 튄 것으로 보고 버린다.
 * 여러 화면·버튼에 걸친 차단은 이 값이 아니라 navigationGate.ts가 더 짧은 구간으로 맡는다 —
 * 그쪽은 뒤로 갔다가 바로 다음을 누르는 것처럼 정당한 연속 입력이 있어서 길게 잡으면 안 된다.
 */
export const SINGLE_PRESS_INTERVAL_MS = 700;

/**
 * @param lastAcceptedAt 직전에 통과시킨 입력의 시각(ms). 아직 없으면 null.
 * @param now 이번 입력의 시각(ms).
 * @param intervalMs 차단 구간. 기본 SINGLE_PRESS_INTERVAL_MS.
 */
export function shouldAcceptPress(lastAcceptedAt: number | null, now: number, intervalMs: number = SINGLE_PRESS_INTERVAL_MS): boolean {
  if (lastAcceptedAt === null) return true;
  // 시스템 시계가 뒤로 돌아가는 경우(now < lastAcceptedAt) 차단이 영구히 걸리지 않도록 통과시킨다.
  if (now < lastAcceptedAt) return true;
  return now - lastAcceptedAt >= intervalMs;
}
