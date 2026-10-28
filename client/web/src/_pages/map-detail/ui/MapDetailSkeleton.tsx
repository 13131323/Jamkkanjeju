'use client';

import { Skeleton, SkeletonGroup } from '@shared/ui/skeleton';

export function MapDetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="bg-cool-neutral-white w-full" style={{ paddingTop: `var(--safe-area-top)` }}>
      <button type="button" aria-label="뒤로가기" onClick={onBack} className="mx-5 mt-3 flex h-8 w-8 items-center justify-center rounded-full">
        <ChevronLeftIcon />
      </button>

      <SkeletonGroup>
        <div className="flex flex-col gap-2 pt-3">
          <Skeleton className="mx-5 h-50 rounded-xl" />
        </div>

        <div className="flex flex-col gap-10 py-5">
          <div className="flex flex-col gap-2.5 px-4">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-warm-neutral-50 h-1.5 w-full" />
            <div className="px-4">
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="flex flex-col gap-2.5 px-4">
              {[0, 1].map((i) => (
                <div key={i} className="flex w-full items-center gap-3 p-3">
                  <Skeleton className="h-16 w-16 shrink-0 rounded-md" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-3/5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SkeletonGroup>
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
