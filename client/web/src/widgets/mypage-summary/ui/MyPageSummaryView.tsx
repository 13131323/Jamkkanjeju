'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { MyPageArCharacter, MyPageProfile, MyPageSummary } from '@shared/api/myPage';
import { resolveArCharacterColorFamily, type ArCharacterColorFamily } from '@entities/ar-character';
import { useMyPage } from '@entities/user';
import { useStepCount } from '@features/app-bridge';
import charactorRounded from '@shared/lib/images/mypage/charactor-rounded01.png';
import aiPostMainImage from '@shared/lib/images/ai-post-main-image.png';
import { resumeMission, useMissionProgress, type MissionProgressCardData } from '../model/useMissionProgress';
import { MyPageSkeleton } from './MyPageSkeleton';

const POSTCARD_COPY = {
  title: '엽서로 이번 여행을\n완성해보세요',
  description: '그동안의 여행 기록을 담아봐요',
  ctaLabel: '여행 엽서 만들기',
};

function ProfileCard({ profile, stepsGoal }: { profile: MyPageProfile; stepsGoal: number }) {
  const router = useRouter();
  const liveSteps = useStepCount();
  const nickname = profile.nickname ?? '';
  const badges = profile.travelStyle?.hashtags ?? [];
  const avatarUrl = profile.characterImgUrl;

  return (
    <div className="bg-cool-neutral-white flex flex-col gap-5 rounded-2xl p-5 shadow-[4px_4px_14px_rgba(0,0,0,0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-heading-h4 text-warm-neutral-900 font-bold">{nickname}</span>
            <button type="button" aria-label="프로필 수정" onClick={() => router.push('/mypage/edit')} className="flex items-center justify-center">
              <EditIcon />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {badges.map((badge) => (
              <span key={badge} className="border-cool-neutral-200 text-label-sm text-warm-neutral-700 rounded-full border px-3 py-1 font-medium">
                {badge}
              </span>
            ))}
          </div>
        </div>

        <span className="border-tertiary-400 relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2">
          {avatarUrl ? (
            // 원격 URL이라 next.config.ts images에 등록되지 않은 도메인 — next/image 최적화 대상이 아니다.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" aria-hidden="true" className="h-full w-full object-cover" />
          ) : (
            <Image src={charactorRounded} alt="" aria-hidden="true" fill sizes="64px" className="object-cover" />
          )}
        </span>
      </div>

      <div className="bg-warm-neutral-50 flex items-center justify-between rounded-xl px-4 py-3">
        <span className="text-label-md text-warm-neutral-700 flex items-center gap-1.5 font-medium">
          <span aria-hidden="true">👣</span>
          오늘 걸음 수
        </span>
        <span className="text-label-lg text-warm-neutral-500 font-medium">
          {stepsGoal.toLocaleString('ko-KR')} / <span className="text-warm-neutral-900 font-bold">{(liveSteps ?? 0).toLocaleString('ko-KR')}</span>
        </span>
      </div>
    </div>
  );
}

function StatsRow({ summary }: { summary: MyPageSummary }) {
  const stats = [
    { id: 'visited', label: '방문한 장소', value: summary.visitedLocationCount ?? 0, unit: '곳' },
    { id: 'missions', label: '완료한 미션', value: summary.completedMissionCount ?? 0, unit: '개' },
    { id: 'points', label: '보유 포인트', value: summary.point ?? 0, unit: 'P' },
  ];

  return (
    <div className="bg-cool-neutral-white flex items-center rounded-2xl py-4 shadow-[4px_4px_14px_rgba(0,0,0,0.12)]">
      {stats.map((stat, index) => (
        <div key={stat.id} className={`flex flex-1 flex-col items-center gap-1.5 ${index === 0 ? '' : 'border-cool-neutral-100 border-l'}`}>
          <span className="text-label-md text-warm-neutral-600 font-medium">{stat.label}</span>
          <span className="text-heading-h4 text-warm-neutral-900 font-bold">
            {stat.value.toLocaleString('ko-KR')}
            <span className="text-label-md text-warm-neutral-600 ml-0.5 font-medium">{stat.unit}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function PostcardCtaCard() {
  const router = useRouter();
  const { title, description, ctaLabel } = POSTCARD_COPY;

  return (
    <div className="bg-cool-neutral-white flex flex-col gap-5 rounded-2xl p-5 shadow-[4px_4px_14px_rgba(0,0,0,0.12)]">
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <p className="text-heading-h4 text-warm-neutral-900 font-bold whitespace-pre-line">{title}</p>
          <p className="text-body-sm text-warm-neutral-800">{description}</p>
        </div>
        {/* absolute라 이 줄의 높이엔 영향을 안 주고, 그만큼 아래 버튼 쪽으로 자연스럽게 걸쳐 내려온다.
            버튼에 z-10을 줘서 겹치는 부분은 버튼이 위에 그려지도록(이미지가 버튼 뒤로 살짝 가려짐) 한다. */}
        <div className="absolute top-0 right-0 h-28 w-32" aria-hidden="true">
          <Image src={aiPostMainImage} alt="" fill className="object-contain" />
        </div>
      </div>
      <button
        type="button"
        onClick={() => router.push('/mypage/travel-ending')}
        className="bg-cool-neutral-900 text-label-lg text-cool-neutral-white relative z-10 w-full rounded-full py-3.5 font-bold"
      >
        {ctaLabel}
      </button>
    </div>
  );
}

/**
 * 진행중인 미션 한 장.
 *
 * 시안(assets/images/MyPageScreen.png): 제목과 `3 / 5`가 같은 줄에 있고 그 아래로 진행 막대가
 * 폭을 채운다. 그림은 두 줄 오른쪽에 세로 가운데로 붙는다. 카드 자체의 흰 판·그림자는
 * 섹션이 갖고 있어서(`MissionProgressSection`) 여기서는 내용만 그린다 — 카드마다 판을 깔면
 * 시안의 "한 장짜리 카드 안에서 넘겨 보는" 모양이 아니라 판이 여러 개 늘어선 모양이 된다.
 */
function MissionProgressCard({ mission }: { mission: MissionProgressCardData }) {
  // total이 0으로 오면 NaN이 되어 막대 폭이 사라진다. 진행 중인 미션에는 없는 값이지만 방어해 둔다
  const percent = mission.total > 0 ? Math.min(100, Math.round((mission.current / mission.total) * 100)) : 0;

  return (
    <button type="button" onClick={() => resumeMission(mission)} aria-label={`${mission.title} 이어서 진행하기`} className="flex w-full items-center gap-4 text-left">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-heading-h4 text-warm-neutral-900 font-bold">{mission.title}</span>
          {/* 시안은 진행 수만 초록 굵게, 전체 수는 회색이다 — 지금 어디까지 왔는지가 먼저 읽힌다 */}
          <span className="text-label-lg text-cool-neutral-400 font-medium">
            <span className="text-tertiary-600 font-bold">{mission.current}</span> / {mission.total}
          </span>
        </div>
        <div className="bg-cool-neutral-100 h-2 w-full overflow-hidden rounded-full">
          <div className="bg-tertiary-600 h-full rounded-full" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <span className="relative h-16 w-16 shrink-0">
        <Image src={mission.image} alt="" aria-hidden="true" fill sizes="64px" className="object-contain" />
      </span>
    </button>
  );
}

function MissionProgressSection() {
  const { missions, isPending } = useMissionProgress();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  // 진행중인 미션이 없으면(응답 전 포함) 섹션을 통째로 숨긴다 — 홈의 진행중 미션 카드와 같은 규칙이다.
  // 빈 목록에 제목과 인디케이터만 남으면 "불러오지 못한 것"처럼 보인다.
  if (isPending || missions.length === 0) return null;

  // 스크롤로 지금 보고 있는 카드. 헤더의 "이어서 진행"은 **그 카드**를 연다 —
  // 카드가 여러 장인데 헤더가 항상 첫 번째를 열면 보고 있는 것과 다른 미션으로 넘어간다.
  const visibleMission = missions[Math.min(activeIndex, missions.length - 1)];

  return (
    // 시안: 제목·"이어서 진행"·미션 카드·인디케이터가 **흰 판 하나 안에** 들어 있다.
    // 예전에는 제목이 판 밖에 있고 미션마다 판이 따로였다.
    <section className="bg-cool-neutral-white flex flex-col gap-4 rounded-2xl p-5 shadow-[4px_4px_14px_rgba(0,0,0,0.12)]">
      <div className="flex items-center justify-between">
        <h2 className="text-label-lg text-warm-neutral-900 font-bold">진행중인 미션</h2>
        <button type="button" onClick={() => resumeMission(visibleMission)} className="text-label-sm text-warm-neutral-500 flex items-center gap-1 font-medium">
          이어서 진행
          <ChevronRightIcon />
        </button>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex snap-x snap-mandatory scrollbar-none gap-5 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden">
        {missions.map((mission) => (
          <div key={`${mission.missionType}-${mission.missionId}`} className="w-full shrink-0 snap-center">
            <MissionProgressCard mission={mission} />
          </div>
        ))}
      </div>

      {/* 한 장뿐이면 넘길 것이 없다 — 점 하나만 남으면 무엇을 뜻하는지 알 수 없다 */}
      {missions.length > 1 && (
        <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
          {missions.map((mission, index) => (
            <span
              key={`${mission.missionType}-${mission.missionId}`}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${index === activeIndex ? 'bg-warm-neutral-900' : 'bg-cool-neutral-200'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// characterColor 계열별 도감 타일 배경. Tailwind가 동적 클래스명을 인식 못해 완성된 문자열로 매핑해 둔다
// (ArCharacterPage.tsx의 COLOR_THEME과 같은 이유).
const CHARACTER_TILE_BACKGROUND: Record<ArCharacterColorFamily, string> = {
  primary: 'bg-primary-100',
  tertiary: 'bg-tertiary-100',
  sunnyYellow: 'bg-sunny-yellow-100',
  warmNeutral: 'bg-warm-neutral-100',
  coolNeutral: 'bg-cool-neutral-100',
  vibrantOrange: 'bg-vibrant-orange-100',
};

function CharacterEntryThumbnail({ character, onSelect }: { character: MyPageArCharacter; onSelect: () => void }) {
  const unlocked = character.isAcquired ?? false;
  const tileBackground = unlocked ? CHARACTER_TILE_BACKGROUND[resolveArCharacterColorFamily(character.characterColor)] : 'bg-cool-neutral-100';

  return (
    // 시안: 정사각 타일에 라운딩 14, 그림은 타일을 거의 꽉 채운다(안쪽 여백이 좁다)
    <button type="button" onClick={onSelect} className="flex w-19 shrink-0 flex-col items-center gap-2">
      <span className={`flex h-19 w-19 items-center justify-center overflow-hidden rounded-[14px] p-1.5 ${tileBackground}`}>
        {unlocked ? (
          // 원격 URL이라 next/image 최적화 대상이 아니다(ProfileCard 아바타와 동일한 이유).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={character.imageUrl} alt="" aria-hidden="true" className="h-full w-full object-contain" />
        ) : (
          <span className="text-heading-h4 text-cool-neutral-400 font-bold">?</span>
        )}
      </span>
      <span className="text-label-sm text-warm-neutral-600 w-full truncate text-center font-medium">{unlocked ? character.name : `${character.acquiredFragmentCount}/${character.requiredFragmentCount}`}</span>
    </button>
  );
}

function CharacterCollectionSection({ arCharacters }: { arCharacters: MyPageArCharacter[] }) {
  const router = useRouter();
  const [guideCharacter, setGuideCharacter] = useState<MyPageArCharacter | null>(null);

  if (arCharacters.length === 0) return null;

  // 얻은 캐릭터를 먼저 보여준다(기획 요청) — 그룹 안에서의 순서(서버가 내려준 순서)는 그대로 둔다.
  const sortedCharacters = [...arCharacters].sort((a, b) => Number(b.isAcquired ?? false) - Number(a.isAcquired ?? false));

  function handleSelect(character: MyPageArCharacter, unlocked: boolean) {
    if (unlocked) {
      router.push(`/ar/${character.id}`);
    } else {
      setGuideCharacter(character);
    }
  }

  return (
    // 시안: 제목이 흰 판 **안** 왼쪽 위에 작게 들어간다(진행중인 미션 섹션과 같은 형태)
    <section className="bg-cool-neutral-white flex flex-col gap-4 rounded-2xl p-5 shadow-[4px_4px_14px_rgba(0,0,0,0.12)]">
      <h2 className="text-label-lg text-warm-neutral-900 font-bold">AR 캐릭터 도감</h2>

      <div className="flex scrollbar-none gap-2.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {sortedCharacters.map((character) => {
          const unlocked = character.isAcquired ?? false;
          return <CharacterEntryThumbnail key={character.id} character={character} onSelect={() => handleSelect(character, unlocked)} />;
        })}
      </div>

      {/*
        시안의 인디케이터는 점이 아니라 **가로 스크롤 막대**다 — 도감은 캐릭터가 계속 늘어나는
        목록이라 "몇 장 중 몇 번째"보다 "얼마나 더 있는지"가 맞는 표시다.
        실제 스크롤 위치를 따라가지는 않는다(그러려면 onScroll을 붙여야 한다) —
        지금은 시안의 정지 상태 모양만 옮겼다. [보완 필요]
      */}
      <div className="bg-cool-neutral-100 mx-auto h-1 w-24 overflow-hidden rounded-full" aria-hidden="true">
        <span className="bg-warm-neutral-500 block h-full w-1/2 rounded-full" />
      </div>

      {guideCharacter && <CharacterAcquireGuideModal character={guideCharacter} onClose={() => setGuideCharacter(null)} />}
    </section>
  );
}

// 미획득 캐릭터 클릭 시 뜨는 안내 모달. HomePage의 TodoListModal(중앙 정렬 카드형)과 동일한 톤으로 만듦.
function CharacterAcquireGuideModal({ character, onClose }: { character: MyPageArCharacter; onClose: () => void }) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleGoToMap() {
    router.push('/map');
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`} onClick={onClose}>
      <div
        className={`bg-cool-neutral-white mx-4 flex w-full max-w-90 flex-col gap-5 rounded-3xl px-6 py-7 transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-heading-h3 text-warm-neutral-900 font-bold">아직 만나지 못한 캐릭터예요</p>
          <button type="button" onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <span className="bg-cool-neutral-100 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl">
            <span className="text-heading-h3 text-cool-neutral-400 font-bold">?</span>
          </span>
          <p className="text-body-md text-warm-neutral-700 text-center">{character.acquireCondition}</p>
        </div>

        {character.availableMissions.length > 0 && (
          <div className="flex flex-col gap-2">
            {character.availableMissions.map((mission) => (
              <div key={mission.missionId} className="bg-warm-neutral-50 rounded-xl px-4 py-3">
                <span className="text-body-md text-warm-neutral-800">{mission.missionTitle}</span>
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={handleGoToMap} className="bg-cool-neutral-900 text-label-lg text-cool-neutral-white w-full rounded-full py-3.5 font-bold">
          미션하러가기
        </button>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-warm-neutral-400" />
    </svg>
  );
}

export function MyPageSummaryView() {
  const { data, isLoading, isError } = useMyPage();

  if (isLoading) {
    return <MyPageSkeleton />;
  }
  if (isError || !data) {
    return <p className="text-body-sm text-warm-neutral-600 w-full px-4 py-12 text-center">마이페이지를 불러오지 못했어요. 다시 시도해주세요</p>;
  }

  return (
    <div className="flex w-full flex-col gap-4 px-4 pt-4 pb-12">
      <ProfileCard profile={data.profile} stepsGoal={data.dailyStep.targetStepCount} />
      <StatsRow summary={data.summary} />
      <PostcardCtaCard />
      <MissionProgressSection />
      <CharacterCollectionSection arCharacters={data.arCharacters} />
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M9.5 2.3a1.1 1.1 0 011.6 0l.6.6a1.1 1.1 0 010 1.6l-6.4 6.4-2.6.6.6-2.6 6.2-6.6z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-warm-neutral-400"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="5" height="9" viewBox="0 0 5 9" fill="none" aria-hidden="true">
      <path d="M1 1L4 4.5L1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-warm-neutral-600" />
    </svg>
  );
}
