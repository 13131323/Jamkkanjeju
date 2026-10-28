'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@shared/api/query/queryClient';
import { AppCompatibilityGate, useSafeAreaFromApp } from '@features/app-bridge';
// 배럴(@entities/location)이 아니라 모듈을 직접 가리킨다. 배럴은 useCurrentAddress →
// 카카오맵 SDK 로더 → @shared/config/env까지 끌고 오는데, env는 모듈이 평가되는 순간
// 검증에 실패하면 던진다. 루트에서 배럴을 물면 지도와 무관한 화면(약관 등)까지
// 그 검증에 묶여 통째로 죽는다.
import { useJudgeModeHydration } from '@entities/location/model/judgeMode';
import { sendToApp } from '@shared/lib/bridge/utils';

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  // 안전영역은 루트 CSS 변수라 특정 페이지가 아니라 여기서 한 번만 구독한다
  useSafeAreaFromApp();

  // 심사위원용 모드의 효과(제주 고정)는 지도·주소 등 모든 화면에 걸리므로 되살리기는 루트가 한다.
  // 앱에 알리는 일은 홈만 한다 — 모든 라우트에서 보내면 WebView 6개가 다 받는다(useJudgeModeAppSync)
  useJudgeModeHydration();

  useEffect(() => {
    sendToApp({ type: 'PING', payload: { timestamp: Date.now() } });
  }, []);

  return (
    <Sentry.ErrorBoundary fallback={<p>오류가 발생했습니다.</p>}>
      {/* 앱이 낡거나 API 주소가 어긋나면 모든 화면이 401이라 데이터를 채울 수 없다.
          루트에서 한 번 갈라 안내를 띄운다 — 화면마다 "불러오지 못했어요"를 내면
          사용자는 서버 장애로 읽고 재시도만 반복한다(AppCompatibilityGate) */}
      <AppCompatibilityGate>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AppCompatibilityGate>
    </Sentry.ErrorBoundary>
  );
}
