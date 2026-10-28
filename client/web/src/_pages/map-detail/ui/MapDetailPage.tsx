'use client';

import { use, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { buildGuestbookWriteHref } from '@entities/guestbook';
import { useDisplayLocation } from '@entities/location';
import { usePlaceDetail, toRewardBadges, type PlaceDetailMission, type PlaceNearbyMission, type PlaceReview } from '@entities/place';
import { isAppWebView, sendToApp } from '@shared/lib/bridge/utils';
import { JEJU_CENTER, formatDistance } from '@shared/config/geo';
import { formatVisitedAt } from '@shared/lib/formatVisitedAt';

type MapDetailPageProps = {
  params: Promise<{ placeId: string }>;
};

export function MapDetailPage({ params }: MapDetailPageProps) {
  const { placeId } = use(params);
  const locationId = Number(placeId);
  const router = useRouter();
  const { coords } = useDisplayLocation();
  const { data: detail, isLoading, isError, isNotFound } = usePlaceDetail(locationId, coords ?? JEJU_CENTER);

  /**
   * 뒤로가기.
   *
   * 앱 WebView는 이 경로를 **첫 페이지로** 열기 때문에 되돌아갈 히스토리가 없다 —
   * router.back()은 아무 일도 하지 않는다. 그때는 앱에게 스택을 pop해 달라고 넘긴다.
   */
  const goBack = () => {
    if (isAppWebView()) {
      sendToApp({ type: 'NAVIGATE_BACK', payload: {} });
      return;
    }
    router.back();
  };

  if (Number.isNaN(locationId)) {
    return <CenteredMessage onBack={goBack} text="장소를 찾을 수 없어요" />;
  }
  if (isLoading) {
    return <CenteredMessage onBack={goBack} text="불러오는 중..." />;
  }
  // 없는 장소(404)와 그 밖의 실패(네트워크·서버 오류)는 문구를 갈라야 한다.
  if (isNotFound || !detail) {
    return <CenteredMessage onBack={goBack} text="장소를 찾을 수 없어요" />;
  }
  if (isError) {
    return <CenteredMessage onBack={goBack} text="정보를 불러오지 못했어요. 다시 시도해주세요" />;
  }

  return (
    <div className="bg-cool-neutral-white w-full" style={{ paddingTop: `var(--safe-area-top)` }}>
      <button type="button" aria-label="뒤로가기" onClick={goBack} className="mx-5 mt-3 flex h-8 w-8 items-center justify-center rounded-full">
        <ChevronLeftIcon />
      </button>

      <HeroImage imageUrls={detail.imageUrls} />

      <div className="flex flex-col gap-10 py-5">
        <div className="flex flex-col gap-2.5 px-4">
          <div className="flex items-center gap-2">
            <h1 className="text-heading-h2 text-cool-neutral-950 font-bold">{detail.locationTitle}</h1>
            <span className="bg-tertiary-100 text-label-sm text-cool-neutral-950 rounded-sm px-2 py-1 font-semibold">{detail.locationCategory}</span>
          </div>
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
            {/* missionId는 공통 MISSION.id가 아니라 유형별 세부 미션 id라, 유형이 다르면 값이 겹친다.
                실제로 TREASURE 1번과 COOPERATIVE 1번이 함께 올 수 있다 — key에 유형을 함께 넣어야 충돌하지 않는다 */}
            {detail.nearbyMissions.map((mission) => (
              <MissionCard key={`${mission.missionType}-${mission.missionId}`} mission={mission} />
            ))}
          </div>
        </SectionGroup>

        <SectionGroup>
          <div className="flex items-center justify-between px-4">
            <h2 className="text-label-lg text-cool-neutral-950 font-bold">방명록</h2>
            <span className="text-label-sm text-cool-neutral-400">더보기</span>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4">
            {detail.reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </SectionGroup>
      </div>

      <div className="bg-cool-neutral-white sticky bottom-0 flex gap-2.5 px-4 pt-4" style={{ paddingBottom: `max(28px, var(--safe-area-bottom))` }}>
        {/* 이미 방문했거나(isVisited) 미션을 완료했으면 미션을 다시 시작할 이유가 없다 — 방명록 작성으로 보낸다 */}
        {detail.locationMission && !detail.isVisited && !detail.locationMission.isCompleted ? (
          <button
            type="button"
            onClick={() => handleStartMission(detail.locationMission as PlaceDetailMission)} // TODO: 미션 전용 페이지 라우팅 연결
            className="bg-tertiary-900 text-label-lg text-cool-neutral-white flex h-12 flex-1 items-center justify-center rounded-full font-medium"
          >
            미션 시작하기
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
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
              )
            }
            className="border-cool-neutral-300 bg-cool-neutral-white text-label-lg text-warm-neutral-900 flex h-12 flex-1 items-center justify-center rounded-full border font-medium"
          >
            방명록 작성
          </button>
        )}
      </div>
    </div>
  );
}

// TODO: 미션 전용 페이지가 생기면 mission.missionId로 라우팅 연결
function handleStartMission(mission: PlaceDetailMission) {
  console.log('[mission start click]', mission.missionId);
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
  const scrollRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  if (imageUrls.length === 0) {
    return (
      <div className="flex flex-col gap-2 pt-3">
        <div className="bg-warm-neutral-200 mx-5 h-50 overflow-hidden rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pt-3">
      <div ref={scrollRef} onScroll={handleScroll} className="mx-5 flex h-50 snap-x snap-mandatory scrollbar-none overflow-x-auto rounded-xl [&::-webkit-scrollbar]:hidden">
        {imageUrls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={url} alt="" className="h-50 w-full shrink-0 snap-center object-cover" />
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

function MissionCard({ mission }: { mission: PlaceNearbyMission }) {
  const badges = toRewardBadges(mission.rewardDetail);

  return (
    <div className="flex w-full items-center gap-3 rounded-lg p-3">
      {mission.representativeImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mission.representativeImageUrl} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="bg-warm-neutral-200 h-16 w-16 shrink-0 rounded-md" />
      )}
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          {/* 추천 미션은 저마다 다른 장소에 있다 — 그 장소 이름을 먼저 보여준다 */}
          <span className="bg-warm-neutral-100 text-label-sm text-warm-neutral-700 w-fit rounded-sm px-1.5 py-0.5 font-medium">{mission.locationTitle}</span>
          {badges.map((badge) => (
            <span key={badge.label} className="text-label-sm text-tertiary-700 font-medium">
              {badge.label}
            </span>
          ))}
        </div>
        <span className="text-label-md text-cool-neutral-950 font-bold">{mission.missionTitle}</span>
      </div>
      <ChevronRightIcon />
    </div>
  );
}

function ReviewCard({ review }: { review: PlaceReview }) {
  return (
    <div className="bg-warm-neutral-50 flex w-50 shrink-0 flex-col gap-3 rounded-lg p-3">
      {review.representativeImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={review.representativeImageUrl} alt="" className="h-30 w-full rounded-md object-cover" />
      ) : (
        <div className="bg-warm-neutral-200 relative h-30 w-full rounded-md" />
      )}
      <div className="flex items-center gap-2.5">
        {review.characterImgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={review.characterImgUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
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
