'use client';

import { use, useState, type ReactNode } from 'react';
import Image, { type StaticImageData } from 'next/image';
import { useRouter } from 'next/navigation';
import { buildGuestbookWriteHref, canWriteGuestbookAt } from '@entities/guestbook';
import { useDisplayLocation } from '@entities/location';
import { usePlaceDetail, buildMissionNavigatePayload, type MapMissionType, type PlaceDetailMission, type PlaceNearbyMission, type PlaceReview } from '@entities/place';
import { isAppWebView, sendToApp } from '@shared/lib/bridge/utils';
import { isInitialPathname, readCanGoBack, resolveBackTarget } from '@shared/lib/navigationHistory';
import { JEJU_CENTER, formatDistance } from '@shared/config/geo';
import { formatVisitedAt } from '@shared/lib/formatVisitedAt';
import iconCollaboration from '@shared/lib/images/icon-mission-collaboration.png';
import iconTreasure from '@shared/lib/images/icon-mission-treasure.png';
import iconNavGuestbook from '@shared/lib/images/nav-guestbook.png';
import { SkeletonImage } from '@shared/ui/SkeletonImage';
import { Toast } from '@shared/ui/Toast';
import { useMouseDragScroll } from '@shared/lib/interaction/useMouseDragScroll';
import { MapDetailSkeleton } from './MapDetailSkeleton';

type MapDetailPageProps = {
  params: Promise<{ placeId: string }>;
};

export function MapDetailPage({ params }: MapDetailPageProps) {
  const { placeId } = use(params);
  const locationId = Number(placeId);
  const router = useRouter();
  const { coords } = useDisplayLocation();
  const { data: detail, isLoading, isError, isNotFound, hasNextPage, isFetchingNextPage, fetchNextPage } = usePlaceDetail(locationId, coords ?? JEJU_CENTER);
  const [toastMessage, setToastMessage] = useState<{ id: number; text: string } | null>(null);

  async function handleWriteGuestbookClick() {
    if (!detail) return;
    const canWrite = await canWriteGuestbookAt(locationId);
    if (!canWrite) {
      setToastMessage({ id: Date.now(), text: '방문한 적 없는 장소예요. 방명록을 작성할 수 없어요' });
      return;
    }
    router.push(
      buildGuestbookWriteHref({
        placeId,
        placeName: detail.locationTitle,
        placeAddress: detail.locationAddress,
        ...(detail.locationMission
          ? {
              missionId: String(detail.locationMission.missionId),
              missionTitle: detail.locationMission.missionTitle,
              missionType: detail.locationMission.missionType === 'TREASURE' ? 'treasure' : 'coop',
            }
          : {}),
      }),
    );
  }

  /**
   * 뒤로가기.
   *
   * 앱이 이 경로를 **첫 페이지로** 열었을 때만 앱 스택을 pop해야 한다. 지도·검색·여행끝내기에서
   * router.push로 들어온 경우엔 웹 히스토리가 있는데도 앱 스택을 pop하면 보던 화면을 건너뛴다.
   */
  const goBack = () => {
    const target = resolveBackTarget({ canGoBack: readCanGoBack(), isInitialPath: isInitialPathname(), isWebView: isAppWebView() });

    if (target === 'app-stack') {
      sendToApp({ type: 'NAVIGATE_BACK', payload: {} });
      return;
    }
    // 브라우저로 URL을 직접 열면 돌아갈 곳이 없어 router.back()이 아무 일도 하지 않는다
    if (target === 'map-fallback') {
      router.push('/map');
      return;
    }
    router.back();
  };

  if (!Number.isInteger(locationId) || locationId < 1) {
    return <CenteredMessage onBack={goBack} text="장소를 찾을 수 없어요" />;
  }
  if (isLoading) {
    return <MapDetailSkeleton onBack={goBack} />;
  }
  // 없는 장소(404)와 그 밖의 실패(네트워크·서버 오류)는 문구를 갈라야 한다.
  if (isNotFound) {
    return <CenteredMessage onBack={goBack} text="장소를 찾을 수 없어요" />;
  }
  if (isError && !detail) {
    return <CenteredMessage onBack={goBack} text="정보를 불러오지 못했어요. 다시 시도해주세요" />;
  }
  if (!detail) return <MapDetailSkeleton onBack={goBack} />;

  return (
    <div className="bg-cool-neutral-white w-full" style={{ paddingTop: `var(--safe-area-top)` }}>
      <button type="button" aria-label="뒤로가기" onClick={goBack} className="mx-5 mt-3 flex h-8 w-8 items-center justify-center rounded-full">
        <ChevronLeftIcon />
      </button>

      <HeroImage imageUrls={detail.imageUrls} />

      <div className="flex flex-col gap-10 py-5">
        <div className="flex flex-col gap-2.5 px-4">
          <h1 className="text-heading-h2 text-cool-neutral-950 font-bold">{detail.locationTitle}</h1>
          <span className="text-label-md text-tertiary-700 font-bold">
            {coords ? '현재 위치에서' : '제주 중심에서'} {formatDistance(detail.distanceMeter)}
          </span>
          <span className="text-body-md text-warm-neutral-600">{detail.locationAddress}</span>
          {/* TourAPI 부가 정보라 없을 수 있다 — 없으면 빈 문단을 남기지 않는다 */}
          {detail.description && <p className="text-body-md text-warm-neutral-900 pt-1">{detail.description}</p>}
        </div>

        <SectionGroup>
          <div className="flex items-center justify-between px-4">
            <h2 className="text-label-lg text-cool-neutral-950 font-bold">근처에서 할 수 있는 미션</h2>
            <span className="text-label-sm text-cool-neutral-400">총 {detail.nearbyMissions.length}개</span>
          </div>
          <div className="flex flex-col gap-2.5 px-4">
            {/* v2의 missionId는 미션 홈 조회·시작에 사용하는 공통 미션 ID다. */}
            {detail.nearbyMissions.map((mission) => (
              <MissionCard key={`${mission.missionType}-${mission.missionId}`} mission={mission} onSelect={() => handleStartMission(mission)} />
            ))}
          </div>
        </SectionGroup>

        <SectionGroup>
          <div className="flex items-center justify-between px-4">
            <h2 className="text-label-lg text-cool-neutral-950 font-bold">방명록</h2>
            {hasNextPage && (
              <button
                type="button"
                onClick={() => { void fetchNextPage(); }}
                disabled={isFetchingNextPage}
                className="text-label-sm text-cool-neutral-400"
              >
                {isFetchingNextPage ? '불러오는 중...' : '더보기'}
              </button>
            )}
          </div>
          {detail.reviews.length === 0 ? (
            <p className="text-body-md text-warm-neutral-600 px-4">등록된 방명록이 없습니다</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto px-4">
              {detail.reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </SectionGroup>
      </div>

      <div className="bg-cool-neutral-white sticky bottom-0 flex gap-2.5 px-4 pt-4" style={{ paddingBottom: `max(28px, var(--safe-area-bottom))` }}>
        {/* 방문했거나 미션을 완료했으면 방명록을 쓸 차례다 — 둘 다 아닐 때만 미션 시작 버튼을 보여준다 */}
        {detail.locationMission && !detail.isVisited && !detail.locationMission.isCompleted ? (
          <button
            type="button"
            onClick={() => handleStartMission(detail.locationMission as PlaceDetailMission)}
            className="bg-tertiary-900 text-label-lg text-cool-neutral-white flex h-12 flex-1 items-center justify-center rounded-full font-medium"
          >
            미션 시작하기
          </button>
        ) : (
          <button
            type="button"
            onClick={handleWriteGuestbookClick}
            className="border-cool-neutral-300 bg-cool-neutral-white text-label-lg text-warm-neutral-900 flex h-12 flex-1 items-center justify-center rounded-full border font-medium"
          >
            방명록 작성
          </button>
        )}
      </div>
      {toastMessage && <Toast key={toastMessage.id} message={toastMessage.text} onDone={() => setToastMessage(null)} />}
    </div>
  );
}

// 앱에 미션 인트로 화면을 열어 달라고 알린다 — 미션 화면 자체가 앱에만 있어 web은 직접 라우팅할 수 없다.
// 하단 CTA(이 장소의 미션)와 "근처에서 할 수 있는 미션" 카드가 같은 경로를 쓴다 — 카드는 저마다
// 다른 장소의 미션이라 각자의 missionId가 실린다(missionNavigate.ts).
function handleStartMission(mission: PlaceDetailMission) {
  sendToApp({ type: 'NAVIGATE', payload: buildMissionNavigatePayload(mission) });
}

function CenteredMessage({ text, onBack }: { text: string; onBack: () => void }) {
  return (
    <div className="relative flex h-dvh w-full items-center justify-center px-5 text-center">
      <button
        type="button"
        aria-label="뒤로가기"
        onClick={onBack}
        className="bg-warm-neutral-50 absolute left-5 flex h-8 w-8 items-center justify-center rounded-full"
        style={{ top: `calc(var(--safe-area-top) + 12px)` }}
      >
        <ChevronLeftIcon />
      </button>
      <p className="text-label-md text-warm-neutral-600">{text}</p>
    </div>
  );
}

function SectionGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-warm-neutral-50 h-1.5 w-full" />
      {children}
    </div>
  );
}

function HeroImage({ imageUrls }: { imageUrls: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { scrollRef, dragHandlers } = useMouseDragScroll();

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  // 사진이 하나도 없으면 회색 빈 박스를 남기지 않고 영역 자체를 그리지 않는다
  if (imageUrls.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 pt-3">
      <div ref={scrollRef} {...dragHandlers} onScroll={handleScroll} className="mx-5 flex h-50 cursor-grab select-none active:cursor-grabbing snap-x snap-mandatory scrollbar-none overflow-x-auto rounded-xl [&::-webkit-scrollbar]:hidden">
        {imageUrls.map((url) => (
          <SkeletonImage key={url} src={url} className="h-50 w-full shrink-0 snap-center" />
        ))}
      </div>
      {/* 사진 여러 장 중 현재 위치를 나타내는 페이지네이션 — 한 장뿐이면 굳이 안 보여준다 */}
      {imageUrls.length > 1 && (
        <div className="flex items-center justify-center gap-1">
          {imageUrls.map((_, i) => (
            <span key={i} className={i === activeIndex ? 'bg-tertiary-600 h-1.5 w-4 rounded-full' : 'bg-cool-neutral-200 h-1.5 w-1.5 rounded-full'} />
          ))}
        </div>
      )}
    </div>
  );
}

// 미션 유형별 badge 배경/글자색 — HomePage.tsx의 MISSION_BANNER_STYLE과 같은 짝(treasure bg-tertiary-100/text-tertiary-600,
// coop bg-vibrant-orange-100/text-vibrant-orange-500)을 써서 화면마다 색 인상이 갈리지 않게 한다.
const MISSION_TYPE_BADGE_CLASS: Record<MapMissionType, string> = {
  TREASURE: 'bg-tertiary-100 text-tertiary-800',
  COOPERATIVE: 'bg-vibrant-orange-100 text-vibrant-orange-700',
};

// 사진이 없거나 못 불러왔을 때 사진 자리 가운데에 넣는 아이콘. 미션 마커에 쓰는 것과 같은 에셋이다.
const MISSION_FALLBACK_ICON: Record<MapMissionType, StaticImageData> = {
  TREASURE: iconTreasure,
  COOPERATIVE: iconCollaboration,
};

// 사진 자리를 아이콘으로 채울 때의 배경. 홈 배너 아이콘 타일(MISSION_BANNER_STYLE)과 같은 미션별 색이라
// 회색 빈 박스보다 아이콘이 자리에 자연스럽게 앉는다.
const MISSION_FALLBACK_BG_CLASS: Record<MapMissionType, string> = {
  TREASURE: 'bg-tertiary-100',
  COOPERATIVE: 'bg-vibrant-orange-100',
};

function FallbackIcon({ src, className }: { src: StaticImageData; className: string }) {
  return <Image src={src} alt="" aria-hidden="true" className={`${className} object-contain`} />;
}

function MissionCard({ mission, onSelect }: { mission: PlaceNearbyMission; onSelect: () => void }) {
  const photoBoxClass = 'flex h-16 w-16 shrink-0 items-center justify-center rounded-md';
  const fallbackIcon = <FallbackIcon src={MISSION_FALLBACK_ICON[mission.missionType]} className="h-9 w-9" />;

  return (
    // 카드 전체가 버튼이다 — 오른쪽 ">"만 눌리는 것처럼 보이지만 실제 탭 영역은 행 전체다
    <button type="button" onClick={onSelect} className="flex w-full items-center gap-3 rounded-lg p-3 text-left">
      {mission.representativeImageUrl ? (
        <SkeletonImage src={mission.representativeImageUrl} className={photoBoxClass} failedBgClass={MISSION_FALLBACK_BG_CLASS[mission.missionType]}>
          {fallbackIcon}
        </SkeletonImage>
      ) : (
        <div className={`${MISSION_FALLBACK_BG_CLASS[mission.missionType]} ${photoBoxClass}`}>{fallbackIcon}</div>
      )}
      <div className="flex flex-1 flex-col gap-1.5">
        {/* 추천 미션은 저마다 다른 장소에 있다 — 그 장소 이름을 먼저 보여준다 */}
        <span className={`text-label-sm w-fit rounded-sm px-1.5 py-0.5 font-medium ${MISSION_TYPE_BADGE_CLASS[mission.missionType]}`}>{mission.missionTitle}</span>
        <span className="text-label-md text-cool-neutral-950 font-bold">{mission.locationTitle}</span>
      </div>
      <ChevronRightIcon />
    </button>
  );
}

function ReviewCard({ review }: { review: PlaceReview }) {
  const photoBoxClass = 'flex h-30 w-full items-center justify-center rounded-md';
  const fallbackIcon = <FallbackIcon src={iconNavGuestbook} className="h-12 w-12" />;

  return (
    <div className="bg-warm-neutral-50 flex w-50 shrink-0 flex-col gap-3 rounded-lg p-3">
      {review.representativeImageUrl ? (
        <SkeletonImage src={review.representativeImageUrl} className={photoBoxClass}>
          {fallbackIcon}
        </SkeletonImage>
      ) : (
        <div className={`bg-warm-neutral-200 ${photoBoxClass}`}>{fallbackIcon}</div>
      )}
      <div className="flex items-center gap-2.5">
        {review.characterImgUrl ? (
          <SkeletonImage src={review.characterImgUrl} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <UserIcon />
          </SkeletonImage>
        ) : (
          <div className="bg-warm-neutral-200 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <UserIcon />
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <span className="text-label-md text-cool-neutral-950 font-bold">{review.userNickname}</span>
          <span className="text-label-sm text-cool-neutral-400">{formatVisitedAt(review.visitedAt)}</span>
        </div>
      </div>
      <p className="text-body-sm text-cool-neutral-950">{review.contentWriting}</p>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12.5 5l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warm-neutral-900" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-warm-neutral-300" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="7" r="3.5" className="fill-warm-neutral-400" />
      <path d="M3 17c1-3.5 4-5.5 7-5.5s6 2 7 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" className="text-warm-neutral-400" />
    </svg>
  );
}
