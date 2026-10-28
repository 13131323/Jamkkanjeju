'use client';

import { Skeleton, SkeletonGroup } from '@shared/ui/skeleton';

// 카드마다 실제 높이가 제각각인 masonify 레이아웃이라, 스켈레톤도 높이를 섞어 흉내 낸다.
const CARD_HEIGHTS = [180, 220, 150, 240, 190, 160];

export function GuestbookFeedSkeleton() {
  return (
    <SkeletonGroup className="w-full columns-2 gap-3 px-4 pt-3 pb-8">
      {CARD_HEIGHTS.map((height, i) => (
        <div key={i} className="mb-3 w-full break-inside-avoid">
          <Skeleton tone="onDark" className="w-full rounded-xl" style={{ height }} />
        </div>
      ))}
    </SkeletonGroup>
  );
}
