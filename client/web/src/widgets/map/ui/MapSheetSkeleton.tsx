'use client';

import { Skeleton, SkeletonGroup } from '@shared/ui/skeleton';

// PlaceModalCard 내부(헤더+방명록 그리드)와 같은 구조로 맞춘 스켈레톤.
export function PlaceModalSkeleton() {
  return (
    <SkeletonGroup>
      <div className="mt-4 flex items-start gap-4">
        <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
        <div className="flex h-auto flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
        </div>
      </div>
      <div className="border-cool-neutral-100 mt-4 border-t" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 pt-4 pb-5">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-square h-30 w-full rounded-lg" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonGroup>
  );
}

// 미션 한 장 스켈레톤 — MissionModalCard(미션 1개)와 FilteredMissionModalCard(미션 목록) 둘 다에서 쓴다.
// MissionListItem과 같은 치수(이미지 110x120, 버튼 h-12)로 맞춘다.
export function MissionListItemSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex gap-3">
        <Skeleton className="h-[110px] w-[120px] shrink-0 rounded-lg" />
        <div className="flex flex-1 flex-col justify-center gap-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <div className="flex gap-2.5">
        <Skeleton className="h-12 flex-1 rounded-full" />
        <Skeleton className="h-12 flex-1 rounded-full" />
      </div>
    </div>
  );
}
