'use client';

import { useEffect, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { GeneratedApi } from '@packages/shared';
import { useMapLocations } from '@entities/place';
import { getGetMapModalApiV1MapModalsGetQueryKey, getMapModalApiV1MapModalsGet } from '@/services/api/map/map';
import { JEJU_CENTER, type Bounds, type Coordinates } from '@shared/config/geo';
import { MissionListItem, type MissionListItemData } from './MissionListItem';

type MissionType = 'treasure' | 'coop';

type FilteredMissionModalCardProps = {
  missionType: MissionType;
  bounds: Bounds | null;
  coords: Coordinates | null;
  onClose: () => void;
};

const MISSION_LABEL: Record<MissionType, string> = {
  treasure: '보물',
  coop: '협동미션',
};

// map/modals(targetType=LOCATION) 응답만 mission.rewardDetail을 갖고 있다(단일 미션 모달과 같은 API).
function extractRewardDetail(data: GeneratedApi.GetMapModalApiV1MapModalsGet200 | undefined): GeneratedApi.FullRewardDetailResponse | undefined {
  if (!data || !('locationTitle' in data)) return undefined;
  return data.mission?.rewardDetail;
}

// PlaceFilterChips에서 보물찾기/협동미션 칩 클릭 시 자동으로 뜨는 목록 모달.
// 1) 현재 화면(bounds) 안의 장소를 map/contents(isClustered=false)로 조회해 해당 미션 유형만 추린다.
// 2) map/contents 목록엔 보상 상세(rewardDetail)가 없어서(미션 마커를 눌러 여는 단일 모달, map/modals에만 있음),
//    추려진 장소마다 map/modals를 다시 호출해 rewardDetail을 채운다 — 그래서 같은 API를 "여러 번" 호출한다.
export function FilteredMissionModalCard({ missionType, bounds, coords, onClose }: FilteredMissionModalCardProps) {
  const center = coords ?? JEJU_CENTER;
  const { locations } = useMapLocations({ bounds, center, isClustered: false });
  const apiMissionType = missionType === 'treasure' ? 'TREASURE' : 'COOPERATIVE';

  const matched = locations.filter((location) => location.mission?.type === apiMissionType);

  const modalResults = useQueries({
    queries: matched.map((location) => {
      const params = { targetType: 'LOCATION' as const, targetId: location.id, userLatitude: center.lat, userLongitude: center.lng };
      return {
        queryKey: getGetMapModalApiV1MapModalsGetQueryKey(params),
        queryFn: ({ signal }: { signal: AbortSignal }) => getMapModalApiV1MapModalsGet(params, undefined, signal),
        throwOnError: false,
      };
    }),
  });

  const items: MissionListItemData[] = matched.map((location, index) => ({
    locationId: location.id,
    locationTitle: location.locationTitle,
    distanceMeter: location.distanceMeter,
    durationMinutes: location.durationMinutes,
    representativeImageUrl: location.representativeImageUrl,
    mission: {
      id: location.mission!.id,
      missionType: location.mission!.type,
      missionTitle: location.mission!.missionTitle,
      isCompleted: location.mission!.isCompleted,
      hasWrittenGuestbook: location.mission!.hasWrittenGuestbook,
      rewardDetail: extractRewardDetail(modalResults[index]?.data),
    },
  }));

  // 마운트 직후 프레임에 translateY를 0으로 바꿔 아래에서 위로 슬라이드-업하며 등장시킨다(NavMenuModal과 동일한 패턴).
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <>
      <div className="absolute inset-0 z-10" onClick={onClose} />
      {/* PlaceModalCard와 동일하게 좌우/하단 여백 없이 화면에 꽉 차는 바텀시트 — 최대 높이는 MissionModalCard 한 장 정도(약 280px)로 제한하고, 그 이상은 내부 스크롤로 처리 */}
      <div
        className="bg-cool-neutral-white absolute inset-x-0 bottom-0 z-20 flex max-h-[370px] flex-col rounded-t-xl px-4 pt-3 shadow-[4px_4px_14px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out"
        style={{ transform: isVisible ? 'translateY(0)' : 'translateY(100%)', paddingBottom: `max(20px, var(--safe-area-bottom))` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-center pb-3">
          <div className="bg-warm-neutral-100 h-1 w-10 rounded-full" />
        </div>

        <p className="text-heading-h3 text-warm-neutral-900 shrink-0 font-bold">
          근처 {MISSION_LABEL[missionType]} {items.length}개
        </p>

        <div className="mt-2 flex flex-col overflow-y-auto">
          {items.map((item, index) => (
            <MissionListItem key={item.locationId} data={item} showTopBorder={index !== 0} onClose={onClose} />
          ))}
        </div>
      </div>
    </>
  );
}
