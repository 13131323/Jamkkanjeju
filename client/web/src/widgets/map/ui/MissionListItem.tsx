'use client';

import type { MapModalRewardDetail } from '@shared/api/mapModal';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MISSION_ROUTE_BY_TYPE } from '@packages/shared';
import { buildGuestbookWriteHref, canWriteGuestbookAt } from '@entities/guestbook';
import { formatDistance, toRewardBadges, type MapMissionType } from '@entities/place';
import { sendToApp } from '@shared/lib/bridge/utils';
import { SkeletonImage } from '@shared/ui/SkeletonImage';
import { Toast } from '@shared/ui/Toast';

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
  rewardDetail?: MapModalRewardDetail;
};

export type MissionListItemData = {
  locationId: number;
  locationTitle: string;
  distanceMeter: number;
  durationMinutes: number;
  mission: MissionListItemMission;
  // map/contents(FilteredMissionModalCard)에만 있음 — map/modals(단일 모달)엔 장소 대표 이미지 필드 자체가 없다.
  representativeImageUrl?: string | null;
  // map/modals(단일 모달)에만 있음 — map/contents 목록엔 없다(장소 방문 여부는 단일 모달에서만 내려준다).
  isVisited?: boolean;
};

// 미션 하나에 대한 정보 행 — FilteredMissionModalCard(여러 미션 목록)와 MissionModalCard(미션 1개 모달)가 공유한다.
export function MissionListItem({ data, showTopBorder, onClose }: { data: MissionListItemData; showTopBorder: boolean; onClose: () => void }) {
  const router = useRouter();
  const { mission, locationId } = data;
  const rewardBadges = mission.rewardDetail ? toRewardBadges(mission.rewardDetail) : [];
  // isVisited는 map/contents 목록엔 없는 필드라, 모르는 경우(undefined)엔 기존처럼 isCompleted만으로 판단한다.
  const showStartButton = data.isVisited === false || !mission.isCompleted;
  const [toastMessage, setToastMessage] = useState<{ id: number; text: string } | null>(null);

  function handleDetailClick() {
    onClose();
    router.push(`/map/${locationId}`);
  }

  function handleStartMissionClick() {
    onClose();
    // 미션 화면 자체가 앱에만 있어 web은 직접 라우팅할 수 없다 — 앱에 인트로 화면을 열어 달라고 알린다.
    sendToApp({ type: 'NAVIGATE', payload: { route: toNavigateRoute(mission.missionType), missionId: mission.id } });
  }

  async function handleWriteGuestbookClick() {
    const canWrite = await canWriteGuestbookAt(locationId);
    if (!canWrite) {
      setToastMessage({ id: Date.now(), text: '방문한 적 없는 장소예요. 방명록을 작성할 수 없어요' });
      return;
    }
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
          {data.representativeImageUrl && <SkeletonImage src={data.representativeImageUrl} className="h-full w-full" />}
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
                  <span className="bg-cool-neutral-100 text-label-sm text-warm-neutral-600 rounded-full px-2 py-1 font-medium">{mission.hasWrittenGuestbook ? '방명록 작성' : '방명록 미작성'}</span>
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
        <button
          type="button"
          onClick={handleDetailClick}
          className="border-cool-neutral-200 bg-cool-neutral-white text-label-md text-warm-neutral-900 flex h-12 flex-1 items-center justify-center rounded-full border font-medium"
        >
          상세보기
        </button>

        {showStartButton ? (
          <button
            type="button"
            onClick={handleStartMissionClick}
            className={`text-label-md text-cool-neutral-white flex h-12 flex-1 items-center justify-center rounded-full font-medium ${START_CTA_CLASS}`}
          >
            미션 시작
          </button>
        ) : (
          <button
            type="button"
            onClick={mission.hasWrittenGuestbook ? undefined : handleWriteGuestbookClick}
            className="bg-cool-neutral-900 text-label-md text-cool-neutral-white flex h-12 flex-1 items-center justify-center rounded-full font-medium"
          >
            {/* TODO: 방명록 조회 플로우 연동 예정 — "방명록 보기"는 지금은 클릭해도 아무 동작 없음 */}
            {mission.hasWrittenGuestbook ? '방명록 보기' : '방명록 작성하기'}
          </button>
        )}
      </div>
      {toastMessage && <Toast key={toastMessage.id} message={toastMessage.text} onDone={() => setToastMessage(null)} />}
    </div>
  );
}

function toNavigateRoute(missionType: MapMissionType): 'culture-mission' | 'treasure-mission' | 'coop-mission' {
  return `${MISSION_ROUTE_BY_TYPE[missionType]}-mission`;
}
