'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { readWebViewAppInfo } from '@shared/api/auth/webViewToken';
import { useAppCompatibility, type AppCompatibility } from '../model/useAppCompatibility';

/**
 * 앱과 이 번들이 맞지 않으면 화면을 대신 그린다.
 *
 * 통째로 막는 이유: 두 경우 모두 **모든 API가 401**이라 어떤 화면도 데이터를 채우지 못한다.
 * 화면마다 "불러오지 못했어요"를 보여 주면 사용자는 서버 장애로 읽고 재시도만 반복하게 된다 —
 * 실제로 필요한 행동(앱 업데이트)은 그 문구에서 유추할 수 없다.
 * docs/trouble/2026-09-09-webview-token-version-skew.md
 */
export function AppCompatibilityGate({ children }: { children: React.ReactNode }) {
  const compatibility = useAppCompatibility();

  useEffect(() => {
    if (compatibility === 'ok') return;

    // 두 경우 다 화면이 통째로 멈추는 상태다. 여기서 남기지 않으면 남는 단서가 없다 —
    // 낡은 앱은 브릿지 메시지를 조용히 버리고, 주소 불일치는 401만 반복하며 401은 기록하지 않는다.
    Sentry.captureMessage(`app compatibility: ${compatibility}`, {
      level: 'error',
      tags: { 'app.compatibility': compatibility },
      // 앱 정보가 없으면(낡은 앱) null이 그대로 남아 "심지 못했다"가 드러난다
      extra: { appInfo: readWebViewAppInfo(), webApiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL },
    });
  }, [compatibility]);

  if (compatibility === 'ok') return children;

  return <BlockedNotice compatibility={compatibility} />;
}

const NOTICE: Record<Exclude<AppCompatibility, 'ok'>, { title: string; body: string }> = {
  'app-outdated': {
    title: '앱을 업데이트해 주세요',
    body: '설치된 앱이 이전 버전이라 정보를 불러올 수 없어요.\n스토어에서 최신 버전으로 업데이트한 뒤 다시 열어 주세요.',
  },
  'api-origin-mismatch': {
    title: '앱을 다시 설치해 주세요',
    body: '앱과 서버 설정이 서로 달라 정보를 불러올 수 없어요.\n스토어에서 최신 버전을 받아 다시 설치해 주세요.',
  },
};

function BlockedNotice({ compatibility }: { compatibility: Exclude<AppCompatibility, 'ok'> }) {
  const { title, body } = NOTICE[compatibility];

  return (
    <div
      className="bg-cool-neutral-white flex min-h-screen w-full flex-col items-center justify-center gap-3 px-8 text-center"
      style={{ paddingTop: `var(--safe-area-top)`, paddingBottom: `var(--safe-area-bottom)` }}
    >
      <h1 className="text-heading-h3 text-cool-neutral-950 font-bold">{title}</h1>
      {/* 두 줄 안내라 개행을 그대로 살린다 */}
      <p className="text-body-md text-warm-neutral-600 whitespace-pre-line">{body}</p>
    </div>
  );
}
