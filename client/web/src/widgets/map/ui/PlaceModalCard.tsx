'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocationModal, usePlaceDetail } from '@entities/place';
import type { Coordinates } from '@shared/config/geo';
import { JEJU_CENTER } from '@shared/config/geo';
import { formatVisitedAt } from '@shared/lib/formatVisitedAt';
import { SkeletonImage } from '@shared/ui/SkeletonImage';
import { useSheetDragToClose } from '../model/useSheetDrag';
import { PlaceModalSkeleton } from './MapSheetSkeleton';
import { SHEET_BOTTOM_PADDING } from '../model/sheetLayout';

type PlaceModalCardProps = {
  locationId: number;
  /** 클릭한 마커의 장소 이미지. map/modals 응답엔 장소 이미지가 없어 이 값으로 채운다 */
  markerImageUrl: string | null;
  coords: Coordinates | null;
  onClose: () => void;
};

// map_place-modal — 미션 없는 장소 마커 클릭 시 뜨는 바텀시트.
// targetType=LOCATION 응답(mission은 항상 null)을 쓴다 — 방명록 마커/클러스터 클릭은 더 이상 이 컴포넌트를 쓰지 않고
// RoadGuestbookDetailModal(targetType=ROAD_GUESTBOOK)로 분리됐다(05.md 참고).
// 좌우 여백 없이 화면에 꽉 차게 열리고, 방명록 목록이 길어질 수 있어 핸들/헤더만 드래그로 닫고 본문은 스크롤한다.
export function PlaceModalCard({ locationId, markerImageUrl, coords, onClose }: PlaceModalCardProps) {
  const router = useRouter();
  const center = coords ?? JEJU_CENTER;
  const { data, isLoading } = useLocationModal(locationId, center);
  /**
   * 방명록 목록만 **장소 상세**에서 가져온다.
   *
   * map/modals(LOCATION)는 이름 그대로 "최신 방명록"만 내려줘서 목록이 몇 건에서 끊긴다.
   * 그런데 같은 응답의 guestbooksCount는 그 장소의 **전체** 개수라, 헤더의 "방명록 N개"와
   * 아래 카드 수가 서로 맞지 않았다. map/locations/{id}는 자르지 않고 다 주므로(상세 화면이
   * 쓰는 그것) 개수를 맞추려면 목록을 이쪽에서 받아야 한다.
   *
   * 나머지(장소명·분류·개수·거리)는 그대로 modals를 쓴다 — 시트를 띄우는 데 필요한 값이라
   * 먼저 오는 쪽이 낫고, 상세 응답은 TourAPI까지 거쳐 더 늦게 온다.
   */
  const { data: detail } = usePlaceDetail(locationId, center);
  // 상세가 닿기 전에는 modals가 준 몇 건으로 먼저 채운다 — 비워두면 빈 시트가 잠깐 보인다.
  const guestbooks = detail?.reviews ?? data?.guestbooks ?? [];
  const { dragY, isDragging, dragHandlers } = useSheetDragToClose(onClose);

  // 마운트 직후 프레임에 translateY를 0으로 바꿔 아래에서 위로 슬라이드-업하며 등장시킨다(NavMenuModal과 동일한 패턴).
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // 로딩 중엔 시트를 즉시 슬라이드업시키고 안을 스켈레톤으로 채운다 — 탭했는데 한동안 아무
  // 반응이 없다가 시트가 뿅 나타나는 것보다, 탭 즉시 반응(시트가 올라옴)이 있는 편이 낫다.
  // 데이터가 없는 건 로딩이 끝났는데도 없는 경우(조회 실패)뿐이다.
  if (!isLoading && !data) return null;

  return (
    <div
      className={`bg-cool-neutral-white absolute inset-x-0 bottom-0 z-20 flex max-h-[370px] flex-col rounded-t-xl shadow-[4px_4px_14px_rgba(0,0,0,0.12)] ${
        isDragging ? '' : 'transition-transform duration-300 ease-out'
      }`}
      style={{ transform: isVisible ? `translateY(${dragY}px)` : 'translateY(100%)' }}
    >
      {/* 핸들만 항상 드래그 영역 — 로딩 중에도 바로 닫을 수 있어야 한다 */}
      <div className="flex shrink-0 justify-center px-4 pt-3" style={{ touchAction: 'none' }} {...dragHandlers}>
        <div className="bg-warm-neutral-100 h-1 w-10 rounded-full" />
      </div>

      {isLoading || !data ? (
        <div className="overflow-y-auto px-4">
          <PlaceModalSkeleton />
        </div>
      ) : (
        <>
          {/* 헤더는 드래그 영역 — 아래 방명록 목록은 자체 스크롤 영역이라 여기서 pointer 이벤트를 가로채면 스크롤과 충돌한다 */}
          <div className="shrink-0 px-4" style={{ touchAction: 'none' }} {...dragHandlers}>
            <div className="mt-4 flex items-start gap-4">
              {/* GET /api/v1/map/modals(targetType=LOCATION) 응답엔 장소 자체의 대표 이미지 필드가 없다(방명록 항목에만 있음) — 그래서 클릭한 마커가 그린 이미지를 쓰고, 그것도 없으면 placeholder */}
              {markerImageUrl ? <SkeletonImage src={markerImageUrl} className="h-12 w-12 shrink-0 rounded-lg" /> : <div className="h-12 w-12 shrink-0 rounded-lg bg-[#272727]" />}

              <div className="flex h-auto flex-1 flex-col gap-2">
                {/* 한 줄에 다 안 들어갈 때만(이름이 길 때만) 자연스럽게 줄바꿈되도록 name·카테고리·상세보기를 같은 flex-wrap 행에 둔다.
                    이름이 짧으면 전부 한 줄에, 이름이 넘치면 나머지(카테고리·상세보기)가 다음 줄로 밀려난다(상세보기는 ml-auto로 그 줄의 오른쪽 끝에 붙는다). */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-heading-h3 text-warm-neutral-900 font-bold">{data.locationTitle}</span>
                  <span className="bg-tertiary-100 text-label-sm text-tertiary-800 rounded-sm px-2 py-0.5 font-semibold">{data.locationCategory}</span>

                  <button
                    type="button"
                    onClick={() => router.push(`/map/${data.id}`)}
                    className="border-cool-neutral-200 bg-cool-neutral-white text-label-sm text-warm-neutral-900 ml-auto flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 font-medium"
                  >
                    <span>상세보기</span>
                    <ChevronRightIcon />
                  </button>
                </div>

                {/* 방명록 개수는 위 줄바꿈 여부와 무관하게 항상 그 아래에 고정 */}
                <div className="flex items-center gap-0">
                  <span className="text-label-lg text-warm-neutral-600 mr-1 font-bold">방명록</span>
                  <span className="text-label-lg text-tertiary-800 font-bold">{data.guestbooksCount}</span>
                  <span className="text-label-lg text-warm-neutral-600 font-bold">개</span>
                </div>
              </div>
            </div>

            <div className="border-cool-neutral-100 mt-4 border-t" />
          </div>

          <div className="grid grow grid-cols-2 gap-x-3 gap-y-5 overflow-y-auto px-4 pt-4" style={{ paddingBottom: SHEET_BOTTOM_PADDING }}>
            {guestbooks.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-2">
                {entry.representativeImageUrl ? (
                  <SkeletonImage src={entry.representativeImageUrl} className="aspect-square h-30 w-full rounded-lg" />
                ) : (
                  <div className="aspect-square h-30 w-full rounded-lg bg-[#787878]" />
                )}

                <div className="flex items-center gap-2">
                  {entry.characterImgUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.characterImgUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="h-10 w-10 shrink-0 rounded-full bg-[#D1D0CE]" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-label-md text-warm-neutral-900 font-bold">{entry.userNickname}</span>
                    <span className="text-label-sm text-warm-neutral-400">{formatVisitedAt(entry.visitedAt)}</span>
                  </div>
                </div>

                <p className="text-body-sm text-warm-neutral-700">{entry.contentWriting}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="5" height="9" viewBox="0 0 5 9" fill="none" aria-hidden="true">
      <path d="M1 1L4 4.5L1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-warm-neutral-900" />
    </svg>
  );
}
