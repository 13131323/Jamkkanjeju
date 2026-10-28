import { useCallback, useRef } from 'react';
import { SINGLE_PRESS_INTERVAL_MS, shouldAcceptPress } from '@/utils/pressGate';

/**
 * onPress 핸들러를 감싸 연타를 한 번으로 접는다. 판정 규칙은 utils/pressGate.ts 참고.
 *
 * 상태가 아니라 ref에 시각을 담는 이유: 차단 여부는 화면에 그릴 값이 아니라서
 * setState로 두면 버튼을 누를 때마다 불필요한 리렌더가 생긴다.
 *
 * 인스턴스마다 별도 ref라 서로 다른 버튼을 연달아 누르는 건 막지 않는다.
 * 화면 전환은 그 경우(첫 탭으로 뜬 다음 화면의 버튼에 두 번째 탭이 꽂히는 것)까지 막아야 해서
 * utils/navigationGate.ts가 모듈 스코프로 따로 들고 있다.
 */
export function useSinglePress<A extends unknown[]>(
  handler: ((...args: A) => void) | undefined,
  intervalMs: number = SINGLE_PRESS_INTERVAL_MS,
): (...args: A) => void {
  const lastAcceptedAtRef = useRef<number | null>(null);

  return useCallback(
    (...args: A) => {
      if (!handler) return;

      const now = Date.now();
      if (!shouldAcceptPress(lastAcceptedAtRef.current, now, intervalMs)) return;

      lastAcceptedAtRef.current = now;
      handler(...args);
    },
    [handler, intervalMs],
  );
}
