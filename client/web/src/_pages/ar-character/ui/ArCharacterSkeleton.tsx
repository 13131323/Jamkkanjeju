'use client';

import { Skeleton, SkeletonGroup } from '@shared/ui/skeleton';

// 카드 색 테마(COLOR_THEME)는 character.colorFamily에서 나오므로 데이터가 오기 전엔 알 수 없다 —
// 배경은 테마 그라데이션 없이 중립 회색으로 두고, 카드 자리만 실제 치수(300x440)로 잡아 둔다.
export function ArCharacterSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="bg-warm-neutral-50 relative flex h-dvh w-full flex-col overflow-hidden">
      <div className="relative z-10 flex items-center justify-between px-5" style={{ paddingTop: `calc(var(--safe-area-top) + 12px)` }}>
        <button type="button" aria-label="뒤로가기" onClick={onBack} className="bg-cool-neutral-white flex h-9 w-9 items-center justify-center rounded-full">
          <ChevronLeftIcon />
        </button>
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>

      <SkeletonGroup className="relative z-10 flex min-h-0 flex-1 flex-col items-center px-6 pt-3">
        <div className="w-full flex-1" aria-hidden="true" />
        <div className="w-full max-w-[300px]">
          <Skeleton className="h-[440px] w-full rounded-[28px]" />
        </div>
        <div className="flex w-full flex-1 items-center justify-center">
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
      </SkeletonGroup>

      <div className="relative z-10 px-5" style={{ paddingBottom: `max(20px, var(--safe-area-bottom))` }}>
        <Skeleton className="h-13.5 w-full rounded-full" />
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
