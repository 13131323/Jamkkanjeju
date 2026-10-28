import { useCallback, useEffect, useState } from 'react';
import { bootstrapSession, type BootstrapStatus } from '@/services/auth';

export interface AppBootstrap {
  /** 'checking'은 아직 결과가 없는 상태 — 스플래시를 유지한다 */
  status: BootstrapStatus | 'checking';
  hasOnboardingResult: boolean;
  retry: () => void;
}

export function useAppBootstrap(): AppBootstrap {
  const [status, setStatus] = useState<BootstrapStatus | 'checking'>('checking');
  const [hasOnboardingResult, setHasOnboardingResult] = useState(false);
  // 재시도 버튼이 눌릴 때마다 값을 올려 effect를 다시 돌린다
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setStatus('checking');
    setAttempt((previous) => previous + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // 언마운트 뒤 setState를 피하려고 cancelled로 막는다.
    void bootstrapSession().then((result) => {
      if (cancelled) return;
      setStatus(result.status);
      setHasOnboardingResult(result.hasOnboardingResult);
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { status, hasOnboardingResult, retry };
}
