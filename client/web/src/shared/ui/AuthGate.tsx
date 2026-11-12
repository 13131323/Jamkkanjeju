'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { readLoginSession, SESSION_EVENT } from '@shared/api/auth/session';
import { requestAuthReissue } from '@shared/api/auth/reissueToken';
/** 저장된 액세스 토큰이 만료되어도 재발급을 먼저 시도하며 로그인 화면으로 즉시 이동하지 않는다. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const publicPage = pathname === '/login' || pathname.startsWith('/cooperative-missions/invite') || pathname.startsWith('/policies/');
  useEffect(() => {
    let active = true;
    const sync = () => {
      if (active) {
        setAuthenticated(!!readLoginSession());
        setReady(true);
      }
    };
    window.addEventListener(SESSION_EVENT, sync);
    window.addEventListener('storage', sync);
    void (async () => {
      const session = readLoginSession();
      if ((session && session.expiresAt <= Date.now()) || (!session && !publicPage)) {
        try {
          await requestAuthReissue(session?.accessToken);
        } catch (cause) {
          const status = (cause as { response?: { status?: number } }).response?.status;
          if (active && status !== 401 && status !== 403 && !readLoginSession()) setError(true);
        }
      }
      sync();
    })();
    return () => {
      active = false;
      window.removeEventListener(SESSION_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
    // 경로 이동마다 재발급하지 않고 첫 진입·명시적 재시도에서만 복원한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);
  useEffect(() => {
    if (ready && !error && !authenticated && !publicPage) router.replace('/login');
    if (ready && authenticated && pathname === '/login') router.replace('/');
  }, [ready, authenticated, publicPage, pathname, router, error]);
  if (error && !publicPage)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-7 text-center">
        <p>인증 서버에 연결하지 못했습니다.</p>
        <button
          className="rounded-full bg-neutral-900 px-6 py-3 text-white"
          onClick={() => {
            setError(false);
            setReady(false);
            setAttempt((n) => n + 1);
          }}
        >
          다시 시도
        </button>
      </div>
    );
  if (!ready || (!authenticated && !publicPage)) return <div className="flex min-h-dvh items-center justify-center bg-white text-sm text-neutral-500">불러오는 중…</div>;
  return children;
}
