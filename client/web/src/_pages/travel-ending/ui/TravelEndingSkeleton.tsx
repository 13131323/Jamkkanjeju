'use client';

import { Skeleton, SkeletonGroup } from '@shared/ui/skeleton';

const CARD_CLASSNAME = 'bg-cool-neutral-white flex flex-col gap-4 rounded-2xl p-5 shadow-[4px_4px_14px_rgba(0,0,0,0.12)]';

export function TravelEndingSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="bg-warm-neutral-50 relative flex h-dvh w-full flex-col overflow-hidden">
      <div className="relative z-10 flex w-full shrink-0 items-center justify-between px-4" style={{ height: `calc(56px + var(--safe-area-top))`, paddingTop: `var(--safe-area-top)` }}>
        <button type="button" aria-label="뒤로가기" onClick={onBack} className="flex items-center justify-center rounded-full p-1">
          <ChevronLeftIcon />
        </button>
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>

      <SkeletonGroup className="flex flex-1 flex-col gap-4 px-4 pb-28">
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>

        {[0, 1].map((i) => (
          <div key={i} className={CARD_CLASSNAME}>
            <Skeleton className="h-5 w-24" />
            {[0, 1].map((j) => (
              <div key={j} className="flex items-center gap-3">
                <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ))}

        <div className={CARD_CLASSNAME}>
          <Skeleton className="h-5 w-16" />
          <div className="flex gap-2">
            <Skeleton className="h-[104px] w-[104px] rounded-lg" />
            <Skeleton className="h-[104px] w-[104px] rounded-lg" />
          </div>
        </div>
      </SkeletonGroup>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12.5 5l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warm-neutral-900" />
    </svg>
  );
}
