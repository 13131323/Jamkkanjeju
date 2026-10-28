'use client';

import { useEffect, useState } from 'react';
import { useLocationModal } from '@entities/place';
import { JEJU_CENTER, type Coordinates } from '@shared/config/geo';
import { MissionListItem } from './MissionListItem';

type MissionModalCardProps = {
  locationId: number;
  coords: Coordinates | null;
  onClose: () => void;
};

// map_contents-modal — 보물찾기/협동미션 마커 클릭 시 뜨는 카드.
// FilteredMissionModalCard(여러 미션 목록 바텀시트)와 같은 형식을 쓰되, 미션 1개만 보여준다(20지도phase3-map-modal.md).
// targetType=LOCATION 응답을 쓴다.
export function MissionModalCard({ locationId, coords, onClose }: MissionModalCardProps) {
  const { data, isLoading } = useLocationModal(locationId, coords ?? JEJU_CENTER);

  // 마운트 직후 프레임에 translateY를 0으로 바꿔 아래에서 위로 슬라이드-업하며 등장시킨다(NavMenuModal과 동일한 패턴).
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (isLoading) return null;
  if (!data || !data.mission) return null;
  const { mission } = data;

  return (
    <>
      <div className="absolute inset-0 z-10" onClick={onClose} />
      <div
        className="bg-cool-neutral-white absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-xl px-4 pt-3 shadow-[4px_4px_14px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out"
        style={{ transform: isVisible ? 'translateY(0)' : 'translateY(100%)', paddingBottom: `max(20px, var(--safe-area-bottom))` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-center pb-3">
          <div className="bg-warm-neutral-100 h-1 w-10 rounded-full" />
        </div>

        <MissionListItem
          data={{
            locationId: data.id,
            locationTitle: data.locationTitle,
            distanceMeter: data.distanceMeter,
            durationMinutes: data.durationMinutes,
            mission: { id: mission.missionId, missionType: mission.missionType, missionTitle: mission.missionTitle, isCompleted: mission.isCompleted, rewardDetail: mission.rewardDetail },
          }}
          showTopBorder={false}
          onClose={onClose}
        />
      </div>
    </>
  );
}
