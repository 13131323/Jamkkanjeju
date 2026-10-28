'use client';

import Image from 'next/image';
import iconCouponStore from '@shared/lib/images/icon-coupon-store.png';
import iconMissionCollaboration from '@shared/lib/images/icon-mission-collaboration.png';
import iconMissionTreasure from '@shared/lib/images/icon-mission-treasure.png';
import type { Bounds } from '@shared/config/geo';
import { useMissionCounts } from '../model/useMissionCounts';
import type { PlaceFilter } from '../model/useFilterState';

const FILTER_OPTIONS: { id: PlaceFilter; label: string; icon?: typeof iconMissionTreasure; borderClassName?: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'treasure', label: '보물찾기', icon: iconMissionTreasure, borderClassName: 'border-warm-neutral-400' },
  { id: 'coop', label: '협동 미션', icon: iconMissionCollaboration, borderClassName: 'border-tertiary-400' },
  // Penpot FilterBar의 `쿠폰 사용처` 칩. 테두리는 Vibrant Orange/200(#ffc88f)
  { id: 'coupon', label: '쿠폰 사용처', icon: iconCouponStore, borderClassName: 'border-vibrant-orange-200' },
];

// 11지도phase2정보.md §0(12지도phase2시작전.md 결정): 필터별 카운트는 필터링된 결과 기준으로 계산한다.
// 현재 화면(bounds) 안에 있는 장소만 센다.
export function PlaceFilterChips({ value, onChange, bounds, isClustered }: { value: PlaceFilter; onChange: (filter: PlaceFilter) => void; bounds: Bounds | null; isClustered: boolean }) {
  const counts = useMissionCounts(bounds, isClustered);

  function countFor(filter: PlaceFilter): number | undefined {
    if (filter === 'all' || filter === 'coupon') return undefined;
    return counts[filter];
  }

  // 전체 너비 스크롤: 좌우 여백은 부모(MapView) 패딩이 아니라 스크롤 콘텐츠 인셋으로 둬야 칩이 패딩 경계에서 잘리지 않는다.
  return (
    <div className="flex scroll-px-4 items-center gap-2 overflow-x-auto px-4 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {FILTER_OPTIONS.map((option) => {
        const active = option.id === value;
        const count = countFor(option.id);

        if (active) {
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className="bg-warm-neutral-900 text-label-md text-cool-neutral-white flex h-[34px] shrink-0 items-center gap-1.5 rounded-full px-3.5 font-medium whitespace-nowrap"
            >
              {option.label}
              {typeof count === 'number' ? ` ${count}` : ''}
            </button>
          );
        }

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`flex h-[34px] shrink-0 items-center gap-2 rounded-full border-2 ${option.borderClassName ?? 'border-tertiary-400'} bg-cool-neutral-white text-label-md text-warm-neutral-800 pr-3 pl-3.5 font-medium whitespace-nowrap shadow-[0_3px_6px_rgba(0,0,0,0.11)]`}
          >
            <span>
              {option.label}
              {typeof count === 'number' ? ` ${count}` : ''}
            </span>
            {option.icon ? <Image src={option.icon} alt="" aria-hidden="true" width={28} height={30} className="rounded-full" /> : null}
          </button>
        );
      })}
    </div>
  );
}
