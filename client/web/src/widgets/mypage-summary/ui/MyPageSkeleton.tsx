'use client';

import { Skeleton, SkeletonGroup } from '@shared/ui/skeleton';

const CARD_CLASSNAME = 'bg-cool-neutral-white rounded-2xl p-5 shadow-[4px_4px_14px_rgba(0,0,0,0.12)]';

// MyPageSummaryView의 5개 섹션(ProfileCard/StatsRow/PostcardCtaCard/MissionProgressSection/
// CharacterCollectionSection)을 실제 치수에 맞춰 그대로 따라간다.
export function MyPageSkeleton() {
  return (
    <SkeletonGroup className="flex w-full flex-col gap-4 px-4 pt-4 pb-12">
      <div className={`${CARD_CLASSNAME} flex flex-col gap-5`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-6 w-24" />
            <div className="flex gap-1.5">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
        </div>
        <Skeleton className="h-11.5 w-full rounded-xl" />
      </div>

      <div className={`${CARD_CLASSNAME} flex items-center py-4`}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`flex flex-1 flex-col items-center gap-1.5 ${i === 0 ? '' : 'border-cool-neutral-100 border-l'}`}>
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-6 w-10" />
          </div>
        ))}
      </div>

      <div className={`${CARD_CLASSNAME} flex flex-col gap-5`}>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-13.5 w-full rounded-full" />
      </div>

      <div className={`${CARD_CLASSNAME} flex flex-col gap-4`}>
        <Skeleton className="h-5 w-28" />
        <div className="flex items-center gap-4">
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <Skeleton className="h-16 w-16 shrink-0" />
        </div>
      </div>

      <div className={`${CARD_CLASSNAME} flex flex-col gap-4`}>
        <Skeleton className="h-5 w-28" />
        <div className="flex gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-19 w-19 shrink-0 rounded-[14px]" />
          ))}
        </div>
      </div>
    </SkeletonGroup>
  );
}
