'use client';

import { Skeleton, SkeletonGroup } from '@shared/ui/skeleton';

// ResultListItem(h-[76px] 행)과 같은 치수로 맞춘 목록 스켈레톤.
export function SearchResultsSkeleton() {
  return (
    <SkeletonGroup className="flex flex-col pt-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex h-[76px] w-full items-center gap-3">
          <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-1/4 rounded-sm" />
          </div>
        </div>
      ))}
    </SkeletonGroup>
  );
}
