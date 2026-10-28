/**
 * 코드 입장에 성공한 뒤 모달을 언제까지 붙잡아 둘지.
 *
 * 성공 즉시 모달을 닫으면 그 자리에서 홈이 새 계정 데이터로 다시 채워지는 과정이 그대로 노출된다
 * (사용자 지적: 빈 화면이 채워지는 느낌). 모달을 "입장 중" 상태로 잠시 남겨 그 구간을 덮는다.
 *
 * 쿼리 캐시를 계정별로 나눈 뒤(shared/api/query/accountScopedHash.ts) 두 번째 전환부터는
 * 캐시 적중이라 최소 유지 시간만 지나면 곧바로 나간다.
 */

/**
 * 준비가 끝나도 이만큼은 "입장 중"을 보여준다.
 *
 * 모드를 켠 직후는 아직 React 리렌더 전이라 `isReady`가 **직전 상태의 값**일 수 있다.
 * 그 한 프레임에 바로 빠져나가면 연출이 없는 것과 같아진다.
 */
export const ENTER_MIN_DWELL_MS = 250;

/** 준비가 끝나지 않아도 여기서는 나간다 — 네트워크가 느리다고 모달에 갇히면 안 된다 */
export const ENTER_MAX_WAIT_MS = 600;

export type JudgeEnterPhase = 'holding' | 'exiting';

export function resolveJudgeEnterPhase({ elapsedMs, isReady }: { elapsedMs: number; isReady: boolean }): JudgeEnterPhase {
  if (elapsedMs >= ENTER_MAX_WAIT_MS) return 'exiting';
  if (elapsedMs >= ENTER_MIN_DWELL_MS && isReady) return 'exiting';
  return 'holding';
}
