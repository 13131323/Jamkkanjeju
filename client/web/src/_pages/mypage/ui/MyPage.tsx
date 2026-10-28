'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MyPageSummaryView } from '@widgets/mypage-summary';
import { sendToApp } from '@shared/lib/bridge/utils';

const PAGE_TITLE = '마이페이지';

function Header({ title, onBack, onSettingsClick }: { title: string; onBack: () => void; onSettingsClick: () => void }) {
  return (
    <div className="relative flex w-full shrink-0 items-center justify-center px-4" style={{ height: `calc(56px + var(--safe-area-top))`, paddingTop: `var(--safe-area-top)` }}>
      <button type="button" aria-label="뒤로가기" onClick={onBack} className="absolute left-4 flex items-center justify-center rounded-full p-1">
        <ChevronLeftIcon />
      </button>
      <span className="text-heading-h4 text-warm-neutral-900 font-bold">{title}</span>
      <button type="button" aria-label="설정" onClick={onSettingsClick} className="absolute right-4 flex items-center justify-center rounded-full p-1">
        <SettingsIcon />
      </button>
    </div>
  );
}

export function MyPage() {
  const router = useRouter();

  // 홈에서 신체 활동 권한을 거절했을 때 여기서 한 번 더 묻는다(요청은 네이티브만 할 수 있어 앱에 위임).
  // 이미 허용된 상태면 앱이 센서를 다시 켜기만 하고 다이얼로그는 뜨지 않으므로, 상태를 따로 묻지 않고
  // 진입 시 한 번만 보낸다. 앱이 아닌 일반 브라우저면 sendToApp이 아무것도 하지 않는다.
  useEffect(() => {
    sendToApp({ type: 'STEP_PERMISSION_REQUEST', payload: {} });
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div className="bg-warm-neutral-50 h-full w-full overflow-y-auto">
        <Header title={PAGE_TITLE} onBack={() => router.push('/')} onSettingsClick={() => router.push('/mypage/settings')} />
        <MyPageSummaryView />
      </div>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12.5 5l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warm-neutral-900" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-warm-neutral-900" />
      <path
        d="M16.2 12.4a1.4 1.4 0 00.28 1.54l.05.05a1.7 1.7 0 11-2.4 2.4l-.05-.05a1.4 1.4 0 00-1.54-.28 1.4 1.4 0 00-.85 1.28v.14a1.7 1.7 0 01-3.4 0v-.08a1.4 1.4 0 00-.92-1.28 1.4 1.4 0 00-1.54.28l-.05.05a1.7 1.7 0 11-2.4-2.4l.05-.05a1.4 1.4 0 00.28-1.54 1.4 1.4 0 00-1.28-.85h-.14a1.7 1.7 0 010-3.4h.08a1.4 1.4 0 001.28-.92 1.4 1.4 0 00-.28-1.54l-.05-.05a1.7 1.7 0 112.4-2.4l.05.05a1.4 1.4 0 001.54.28h.06a1.4 1.4 0 00.85-1.28v-.14a1.7 1.7 0 013.4 0v.08a1.4 1.4 0 00.85 1.28h.06a1.4 1.4 0 001.54-.28l.05-.05a1.7 1.7 0 112.4 2.4l-.05.05a1.4 1.4 0 00-.28 1.54v.06a1.4 1.4 0 001.28.85h.14a1.7 1.7 0 010 3.4h-.08a1.4 1.4 0 00-1.28.85z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-warm-neutral-900"
      />
    </svg>
  );
}
