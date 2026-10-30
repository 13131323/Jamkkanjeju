'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { GuestbookWriteButton } from '@entities/guestbook';
import { GuestbookFeedView } from '@widgets/guestbook-feed';
import { NavMenuButton, NavMenuModal } from '@widgets/nav-menu';

export function TravelNotePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const searchParams = useSearchParams();
  // 기존 장소 링크로 진입하면 새 유형 구분의 장소 방명록을 조회한다.
  const requestedType = searchParams.get('guestbookType');
  const initialGuestbookType = requestedType === 'ROAD' ? 'ROAD'
    : requestedType === 'GENERAL' || searchParams.has('location') ? 'GENERAL' : 'ALL';

  return (
    <div className="bg-cool-neutral-900 relative h-dvh w-full overflow-hidden">
      <div className="h-full w-full overflow-x-hidden overflow-y-auto">
        <GuestbookFeedView initialGuestbookType={initialGuestbookType} />
      </div>

      {/* safe-area(상태바) 구간을 항상 배경색으로 덮는다 — 탭이 top-0가 아니라 safe-area 아래에서 고정되면서
          그 위 좁은 띠로 스크롤되는 카드가 그대로 비쳐 보이던 문제 */}
      <div className="bg-cool-neutral-900 pointer-events-none absolute inset-x-0 top-0 z-10" style={{ height: `var(--safe-area-top)` }} />

      <NavMenuButton
        isOpen={isMenuOpen}
        onClick={() => setIsMenuOpen(true)}
        tooltipLabel="메뉴"
        className="absolute bottom-6 left-4 z-10"
        style={{ bottom: `calc(24px + var(--safe-area-bottom))` }}
      />

      <GuestbookWriteButton className="absolute right-4 bottom-6 z-10" style={{ bottom: `calc(24px + var(--safe-area-bottom))` }} />

      {isMenuOpen && <NavMenuModal onClose={() => setIsMenuOpen(false)} />}
    </div>
  );
}
