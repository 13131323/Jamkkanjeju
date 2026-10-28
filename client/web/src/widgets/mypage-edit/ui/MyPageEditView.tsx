'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  CATEGORY_BY_INTEREST,
  INTEREST_BY_CATEGORY,
  MAX_TRAVEL_INTEREST_SELECT,
  TRANSPORTATION_BY_ID,
  TRANSPORTATION_ID_BY_TRANSPORTATION,
  TRANSPORTATION_OPTIONS,
  TRAVEL_INTEREST_OPTIONS,
  type GeneratedApi,
  type TransportationId,
  type TravelInterestId,
} from '@packages/shared';
import { useUpdateUserProfile, useUserInfo } from '@entities/user';
import charactorImage from '@shared/lib/images/mypage/charactor02.png';
import { STEP_GOAL_POINT_REWARD, STEP_GOAL_PRESETS } from '../model/constants';

const PAGE_TITLE = '프로필 수정';
const NICKNAME_MAX_LENGTH = 12;

const CARD_CLASSNAME = 'bg-cool-neutral-white flex flex-col gap-6 rounded-2xl py-6 px-4 shadow-[4px_4px_14px_rgba(0,0,0,0.12)]';

function IconChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12.5 5l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warm-neutral-900" />
    </svg>
  );
}

function IconClear() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="10" className="fill-cool-neutral-200" />
      <path d="M7 7l6 6M13 7l-6 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Header({ canSave, onBack, onSave }: { canSave: boolean; onBack: () => void; onSave: () => void }) {
  return (
    <div
      className="relative flex w-full shrink-0 items-center justify-between px-4"
      style={{ height: `calc(56px + var(--safe-area-top))`, paddingTop: `var(--safe-area-top)` }}
    >
      <button type="button" aria-label="뒤로가기" onClick={onBack} className="flex items-center justify-center rounded-full p-1">
        <IconChevronLeft />
      </button>
      <span className="text-heading-h4 text-warm-neutral-900 absolute left-1/2 -translate-x-1/2 font-bold">{PAGE_TITLE}</span>
      <button type="button" disabled={!canSave} onClick={onSave} className="bg-tertiary-600 text-label-sm text-cool-neutral-white rounded-full px-5 py-2 font-bold disabled:opacity-40">
        완료
      </button>
    </div>
  );
}

function ProfileCard({
  characterName,
  characterImageUrl,
  nickname,
  onChangeNickname,
}: {
  characterName: string;
  characterImageUrl: string | null;
  nickname: string;
  onChangeNickname: (value: string) => void;
}) {
  return (
    <div className="bg-cool-neutral-white flex items-start justify-between gap-2 rounded-2xl p-4 shadow-[4px_4px_14px_rgba(0,0,0,0.12)]">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-label-sm text-warm-neutral-600 font-medium">대표 캐릭터</span>
          <span className="text-heading-h3 text-warm-neutral-900 truncate font-bold">{characterName}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-label-sm text-warm-neutral-700 font-bold">닉네임</span>
          <div className="border-cool-neutral-200 flex items-center gap-2 rounded-2xl border px-4 py-3.5">
            <input
              type="text"
              value={nickname}
              onChange={(e) => onChangeNickname(e.target.value.slice(0, NICKNAME_MAX_LENGTH))}
              maxLength={NICKNAME_MAX_LENGTH}
              placeholder="닉네임을 입력해주세요"
              className="text-body-md text-warm-neutral-900 placeholder:text-cool-neutral-400 min-w-0 flex-1 bg-transparent outline-none"
            />
            {nickname.length > 0 && (
              <button type="button" aria-label="닉네임 지우기" onClick={() => onChangeNickname('')} className="flex shrink-0 items-center justify-center">
                <IconClear />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-end self-stretch">
        <div className="relative h-35 w-35 shrink-0 overflow-hidden" aria-hidden="true">
          {characterImageUrl ? (
            // 원격 URL이라 next.config.ts images에 등록되지 않은 도메인 — next/image 최적화 대상이 아니다.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={characterImageUrl} alt="" aria-hidden="true" className="h-full w-full object-contain" />
          ) : (
            <Image src={charactorImage} alt="" aria-hidden="true" fill sizes="140px" className="object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}

function ChipButton({ label, selected, onClick, className = '' }: { label: string; selected: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-label-sm rounded-full border-2 px-3 py-1.5 text-center font-medium ${
        selected ? 'border-tertiary-500 bg-tertiary-50 text-warm-neutral-700' : 'border-cool-neutral-200 text-cool-neutral-600'
      } ${className}`}
    >
      {label}
    </button>
  );
}

function TravelStyleSection({ selected, onToggle }: { selected: TravelInterestId[]; onToggle: (id: TravelInterestId) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-label-sm text-warm-neutral-700 font-bold">여행 스타일 변경</span>
      <div className="flex flex-wrap gap-2">
        {TRAVEL_INTEREST_OPTIONS.map((option) => (
          <ChipButton key={option.id} label={option.title} selected={selected.includes(option.id)} onClick={() => onToggle(option.id)} />
        ))}
      </div>
    </div>
  );
}

function TransportSection({ selected, onSelect }: { selected: TransportationId | null; onSelect: (id: TransportationId) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-label-sm text-warm-neutral-700 font-bold">이동 수단</span>
      <div className="flex flex-wrap gap-2">
        {TRANSPORTATION_OPTIONS.map((option) => (
          <ChipButton key={option.id} label={option.title} selected={selected === option.id} onClick={() => onSelect(option.id)} />
        ))}
      </div>
    </div>
  );
}

function StepGoalSection({
  stepsGoal,
  selectedPreset,
  customValue,
  onSelectPreset,
  onSelectCustom,
  onChangeCustomValue,
}: {
  stepsGoal: number;
  selectedPreset: number | null;
  customValue: string;
  onSelectPreset: (value: number) => void;
  onSelectCustom: () => void;
  onChangeCustomValue: (value: string) => void;
}) {
  const isCustomSelected = selectedPreset === null;

  return (
    <div className={CARD_CLASSNAME}>
      <div className="flex flex-col gap-1">
        <span className="text-label-sm text-warm-neutral-700 font-bold">걸음 수 목표</span>
        <span className="text-body-sm text-warm-neutral-600">달성 시 {STEP_GOAL_POINT_REWARD}P를 받게됩니다.</span>
      </div>

      <div className="bg-tertiary-100 flex items-center justify-center rounded-2xl py-6">
        <span className="text-heading-h2 text-warm-neutral-700 font-bold">
          {stepsGoal.toLocaleString('ko-KR')} <span className="text-label-lg font-bold">걸음</span>
        </span>
      </div>

      <div className="flex gap-0.5">
        {STEP_GOAL_PRESETS.map((preset) => (
          <ChipButton key={preset} label={preset.toLocaleString('ko-KR')} selected={selectedPreset === preset} onClick={() => onSelectPreset(preset)} className="flex-1" />
        ))}
        <ChipButton label="직접 입력" selected={isCustomSelected} onClick={onSelectCustom} className="flex-1" />
      </div>

      {isCustomSelected && (
        <input
          type="text"
          inputMode="numeric"
          value={customValue}
          onChange={(e) => onChangeCustomValue(e.target.value)}
          placeholder="목표 걸음 수를 입력해주세요"
          className="border-cool-neutral-200 text-body-md text-warm-neutral-900 placeholder:text-cool-neutral-400 w-full rounded-2xl border px-4 py-3.5 outline-none"
        />
      )}
    </div>
  );
}

// 서버 카테고리 배열 → 화면 id 배열. 화면이 모르는 값(향후 추가된 enum 등)은 조용히 버린다.
function toTravelInterests(categories: string[] | null | undefined): TravelInterestId[] {
  if (!categories) return [];
  return categories.flatMap((category) => {
    const id = INTEREST_BY_CATEGORY[category as GeneratedApi.Category];
    return id ? [id] : [];
  });
}

// 서버는 배열이지만 화면은 단일 선택이라 첫 값만 쓴다(온보딩 저장 때도 배열의 첫 값만 보냈다 — request.ts 참고).
function toTransportationId(transportation: string[] | null | undefined): TransportationId | null {
  const first = transportation?.[0];
  if (!first) return null;
  return TRANSPORTATION_ID_BY_TRANSPORTATION[first as GeneratedApi.Transportation] ?? null;
}

type MyPageEditFormProps = {
  userInfo: GeneratedApi.UserInfoResponse;
};

function MyPageEditForm({ userInfo }: MyPageEditFormProps) {
  const router = useRouter();
  const { mutate: updateProfile, isPending } = useUpdateUserProfile();

  const [nickname, setNickname] = useState(userInfo.nickname ?? '');
  const [travelInterests, setTravelInterests] = useState<TravelInterestId[]>(() => toTravelInterests(userInfo.categories));
  const [transportation, setTransportation] = useState<TransportationId | null>(() => toTransportationId(userInfo.transportation));
  const initialPreset = STEP_GOAL_PRESETS.includes(userInfo.targetStepCount as (typeof STEP_GOAL_PRESETS)[number]) ? userInfo.targetStepCount : null;
  const [stepGoalPreset, setStepGoalPreset] = useState<number | null>(initialPreset);
  const [customStepGoal, setCustomStepGoal] = useState(initialPreset === null ? String(userInfo.targetStepCount) : '');

  const stepsGoal = stepGoalPreset ?? (Number(customStepGoal) || 0);
  const canSave = nickname.trim().length > 0 && !isPending;

  function handleToggleInterest(id: TravelInterestId) {
    setTravelInterests((prev) => {
      if (prev.includes(id)) return prev.filter((interest) => interest !== id);
      if (prev.length >= MAX_TRAVEL_INTEREST_SELECT) return prev;
      return [...prev, id];
    });
  }

  function handleSave() {
    if (!canSave) return;

    // PUT /api/v1/users/me/profile은 부분 갱신이 아니라 프로필 전체를 교체한다.
    // travelStyle(자투리 시간 여행 방식)은 이 화면에 수정 UI가 없어, 불러온 값을 그대로 되돌려보내
    // 저장하지 않은 값이 지워지지 않게 한다.
    updateProfile(
      {
        data: {
          nickname: nickname.trim(),
          categories: travelInterests.map((id) => CATEGORY_BY_INTEREST[id]),
          transportation: transportation ? [TRANSPORTATION_BY_ID[transportation]] : [],
          travelStyle: (userInfo.travelStyle ?? []) as GeneratedApi.TravelStyle[],
          targetStepCount: stepsGoal,
        },
      },
      { onSuccess: () => router.push('/mypage') },
    );
  }

  return (
    <div className="bg-warm-neutral-50 flex min-h-dvh w-full flex-col">
      <Header canSave={canSave} onBack={() => router.push('/mypage')} onSave={handleSave} />
      <div className="flex flex-1 flex-col gap-4 px-4 pt-2 pb-8">
        <ProfileCard characterName={userInfo.userType ?? ''} characterImageUrl={userInfo.arCharacterImageUrl ?? null} nickname={nickname} onChangeNickname={setNickname} />

        <div className={CARD_CLASSNAME}>
          <TravelStyleSection selected={travelInterests} onToggle={handleToggleInterest} />
          <TransportSection selected={transportation} onSelect={setTransportation} />
        </div>

        <StepGoalSection
          stepsGoal={stepsGoal}
          selectedPreset={stepGoalPreset}
          customValue={customStepGoal}
          onSelectPreset={(value) => {
            setStepGoalPreset(value);
            setCustomStepGoal('');
          }}
          onSelectCustom={() => setStepGoalPreset(null)}
          onChangeCustomValue={(value) => setCustomStepGoal(value.replace(/[^0-9]/g, ''))}
        />
      </div>
    </div>
  );
}

export function MyPageEditView() {
  const { data, isLoading, isError } = useUserInfo();

  if (isLoading) {
    return <p className="text-body-sm text-warm-neutral-600 w-full px-4 py-12 text-center">불러오는 중...</p>;
  }
  if (isError || !data) {
    return <p className="text-body-sm text-warm-neutral-600 w-full px-4 py-12 text-center">프로필을 불러오지 못했어요. 다시 시도해주세요</p>;
  }

  return <MyPageEditForm userInfo={data} />;
}
