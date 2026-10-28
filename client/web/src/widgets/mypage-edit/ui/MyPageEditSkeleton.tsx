'use client';

import { Skeleton, SkeletonGroup } from '@shared/ui/skeleton';

const CARD_CLASSNAME = 'bg-cool-neutral-white rounded-2xl py-6 px-4 shadow-[4px_4px_14px_rgba(0,0,0,0.12)]';

export function MyPageEditSkeleton() {
  return (
    <div className="bg-warm-neutral-50 flex min-h-dvh w-full flex-col">
      <div className="relative flex w-full shrink-0 items-center justify-center px-4" style={{ height: `calc(56px + var(--safe-area-top))`, paddingTop: `var(--safe-area-top)` }}>
        <Skeleton className="h-5 w-20" />
      </div>

      <SkeletonGroup className="flex flex-1 flex-col gap-4 px-4 pt-2 pb-8">
        <div className="bg-cool-neutral-white flex items-start justify-between gap-2 rounded-2xl p-4 shadow-[4px_4px_14px_rgba(0,0,0,0.12)]">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-13 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-35 w-35 shrink-0 rounded-xl" />
        </div>

        <div className={`${CARD_CLASSNAME} flex flex-col gap-6`}>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3.5 w-24" />
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-7 w-16 rounded-full" />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3.5 w-16" />
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-7 w-16 rounded-full" />
              ))}
            </div>
          </div>
        </div>

        <div className={`${CARD_CLASSNAME} flex flex-col gap-4`}>
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-19 w-full rounded-2xl" />
        </div>
      </SkeletonGroup>
    </div>
  );
}
