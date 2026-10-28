'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { GuestbookWriteButton } from '@entities/guestbook';
import { GuestbookFeedView } from '@widgets/guestbook-feed';
import { NavMenuButton, NavMenuModal } from '@widgets/nav-menu';

export function TravelNotePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // 지도 상세의 "더보기"로 들어오면 그 장소 칩을 미리 골라준다
  const seedLocationTitle = useSearchParams().get('location');

  return (
    <div className="bg-cool-neutral-900 relative h-dvh w-full overflow-hidden">
      <div className="h-full w-full overflow-x-hidden overflow-y-auto">
        <GuestbookFeedView seedLocationTitle={seedLocationTitle} />
      </div>

      {/* safe-area(상태바) 구간을 항상 배경색으로 덮는다 — 탭이 top-0가 아니라 safe-area 아래에서 고정되면서
          그 위 좁은 띠로 스크롤되는 카드가 그대로 비쳐 보이던 문제 */}
      <div className="bg-cool-neutral-900 pointer-events-none absolute inset-x-0 top-0 z-10" style={{ height: `var(--safe-area-top)` }} />

      {/* 하단 메뉴/방명록작성 버튼 영역 위로 점점 진해지는 블러 — 뒤에 스크롤되는 카드가 버튼 아래서 자연스럽게 흐려지도록 */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5]"
        style={{
          height: 160,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 100%)',
        }}
      />

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
