'use client';

import { useEffect, useState } from 'react';
import { useLocationModal } from '@entities/place';
import { JEJU_CENTER, type Coordinates } from '@shared/config/geo';
import { useSheetDragToClose } from '../model/useSheetDrag';
import { MissionListItemSkeleton } from './MapSheetSkeleton';
import { MissionListItem } from './MissionListItem';
import { SHEET_BOTTOM_PADDING } from '../model/sheetLayout';

type MissionModalCardProps = {
  locationId: number;
  /** v2 모달 대표 이미지를 못 받은 경우 보완할 마커 이미지이다. */
  markerImageUrl: string | null;
  coords: Coordinates | null;
  onClose: () => void;
  embedded?: boolean;
};

// map_contents-modal — 보물찾기/협동미션 마커 클릭 시 뜨는 카드.
// FilteredMissionModalCard(여러 미션 목록 바텀시트)와 같은 형식을 쓰되, 미션 1개만 보여준다(20지도phase3-map-modal.md).
// targetType=LOCATION 응답을 쓴다.
export function MissionModalCard({ locationId, markerImageUrl, coords, onClose, embedded = false }: MissionModalCardProps) {
  const { data, isLoading } = useLocationModal(locationId, coords ?? JEJU_CENTER);
  const { dragY, isDragging, dragHandlers } = useSheetDragToClose(onClose);
  const mission = data?.mission;

  // 마운트 직후 프레임에 translateY를 0으로 바꿔 아래에서 위로 슬라이드-업하며 등장시킨다(NavMenuModal과 동일한 패턴).
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // PlaceModalCard와 같은 이유로 로딩 중에도 시트를 즉시 올리고 스켈레톤을 보여준다(반응성).
  // 데이터가 없는 건 로딩이 끝났는데도 없는 경우(조회 실패)뿐이다.
  if (!isLoading && !mission) return null;

  return (
    <div
      className={`bg-cool-neutral-white flex flex-col px-4 pt-3 ${embedded ? 'relative h-full min-h-0 overflow-y-auto' : 'absolute inset-x-0 bottom-0 z-20 rounded-t-xl shadow-[4px_4px_14px_rgba(0,0,0,0.12)]'} ${
        isDragging ? '' : 'transition-transform duration-300 ease-out'
      }`}
      style={{ transform: embedded ? undefined : isVisible ? `translateY(${dragY}px)` : 'translateY(100%)', paddingBottom: SHEET_BOTTOM_PADDING }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 핸들만 드래그로 닫힘 — MissionListItem은 자체 클릭 영역이라 여기서 pointer 이벤트를 가로채지 않는다 */}
      <div hidden={embedded} className="flex shrink-0 justify-center pb-3" style={{ display: embedded ? 'none' : undefined, touchAction: embedded ? 'pan-y' : 'none' }} {...(embedded ? {} : dragHandlers)}>
        <div className="bg-warm-neutral-100 h-1 w-10 rounded-full" />
      </div>

      {!data || !mission ? (
        <MissionListItemSkeleton />
      ) : (
        <MissionListItem
          data={{
            locationId: data.id,
            locationTitle: data.locationTitle,
            distanceMeter: data.distanceMeter,
            durationMinutes: data.durationMinutes,
            mission: { id: mission.missionId, missionType: mission.missionType, missionTitle: mission.missionTitle, isCompleted: mission.isCompleted, rewardDetail: mission.rewardDetail },
            isVisited: data.isVisited,
            representativeImageUrl: data.representativeImageUrl ?? markerImageUrl,
          }}
          showTopBorder={false}
          onClose={onClose}
        />
      )}
    </div>
  );
}
