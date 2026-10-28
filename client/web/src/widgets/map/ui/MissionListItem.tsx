'use client';

import { useRouter } from 'next/navigation';
import type { GeneratedApi } from '@packages/shared';
import { buildGuestbookWriteHref } from '@entities/guestbook';
import { formatDistance, toRewardBadges, type MapMissionType } from '@entities/place';

// 미션 시작 CTA 색상
const START_CTA_CLASS = 'bg-tertiary-800';

export type MissionListItemMission = {
  id: number;
  missionType: MapMissionType;
  missionTitle: string;
  isCompleted: boolean;
  // map/contents(FilteredMissionModalCard 목록)에만 있음 — map/modals(단일 모달)엔 없다.
  hasWrittenGuestbook?: boolean | null;
  // map/modals(단일 모달)에만 있음 — map/contents 목록엔 없다(보상 상세는 모달에서만 내려준다).
  rewardDetail?: GeneratedApi.FullRewardDetailResponse;
};

export type MissionListItemData = {
  locationId: number;
  locationTitle: string;
  distanceMeter: number;
  durationMinutes: number;
  mission: MissionListItemMission;
  // map/contents(FilteredMissionModalCard)에만 있음 — map/modals(단일 모달)엔 장소 대표 이미지 필드 자체가 없다.
  representativeImageUrl?: string | null;
};

// 미션 하나에 대한 정보 행 — FilteredMissionModalCard(여러 미션 목록)와 MissionModalCard(미션 1개 모달)가 공유한다.
export function MissionListItem({ data, showTopBorder, onClose }: { data: MissionListItemData; showTopBorder: boolean; onClose: () => void }) {
  const router = useRouter();
  const { mission, locationId } = data;
  const rewardBadges = mission.rewardDetail ? toRewardBadges(mission.rewardDetail) : [];

  function handleDetailClick() {
    onClose();
    router.push(`/map/${locationId}`);
  }

  function handleWriteGuestbookClick() {
    onClose();
    // placeAddress는 여기서 못 채운다 — map/contents·map/modals 둘 다 장소 주소 필드가 없다(장소 상세 map/locations/{id}에만 있음).
    router.push(
      buildGuestbookWriteHref({
        placeId: String(locationId),
        placeName: data.locationTitle,
        missionId: String(mission.id),
        missionTitle: mission.missionTitle,
        missionType: mission.missionType === 'TREASURE' ? 'treasure' : 'coop',
      }),
    );
  }

  return (
    <div className={`flex flex-col gap-3 py-4 ${showTopBorder ? 'border-cool-neutral-100 border-t' : ''}`}>
      <div className="flex gap-3">
        <div className="bg-warm-neutral-200 relative h-[110px] w-[120px] shrink-0 overflow-hidden rounded-lg">
          {data.representativeImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.representativeImageUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center gap-1.5">
          <p className="text-body-md text-warm-neutral-900 font-bold">{mission.missionTitle}</p>
          <p className="text-label-sm text-warm-neutral-400">
            {formatDistance(data.distanceMeter)} · 도보 {data.durationMinutes}분
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            {mission.isCompleted ? (
              <>
                <span className="bg-primary-100 text-label-sm text-primary-800 rounded-full px-2 py-1 font-medium">미션 완료</span>
                {mission.hasWrittenGuestbook !== undefined && (
                  <span className="bg-cool-neutral-100 text-label-sm text-warm-neutral-600 rounded-full px-2 py-1 font-medium">
                    {mission.hasWrittenGuestbook ? '방명록 작성' : '방명록 미작성'}
                  </span>
                )}
              </>
            ) : (
              rewardBadges.map((badge) => (
                <span key={badge.label} className="bg-tertiary-50 text-label-sm text-tertiary-800 rounded-full px-2 py-1 font-medium">
                  {badge.label}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2.5">
        <button type="button" onClick={handleDetailClick} className="border-cool-neutral-200 bg-cool-neutral-white text-label-md text-warm-neutral-900 flex-1 rounded-full border py-3 font-medium">
          상세보기
        </button>

        {mission.isCompleted ? (
          <button
            type="button"
            onClick={mission.hasWrittenGuestbook ? undefined : handleWriteGuestbookClick}
            className="bg-cool-neutral-900 text-label-md text-cool-neutral-white flex-1 rounded-full py-3 font-medium"
          >
            {/* TODO: 방명록 조회 플로우 연동 예정 — "방명록 보기"는 지금은 클릭해도 아무 동작 없음 */}
            {mission.hasWrittenGuestbook ? '방명록 보기' : '방명록 작성하기'}
          </button>
        ) : (
          <button type="button" className={`text-label-md text-cool-neutral-white flex-1 rounded-full py-3 font-medium ${START_CTA_CLASS}`}>
            {/* TODO: 미션 상세/시작 플로우 연동 예정 — 지금은 클릭해도 아무 동작 없음 */}
            미션 시작
          </button>
        )}
      </div>
    </div>
  );
}
