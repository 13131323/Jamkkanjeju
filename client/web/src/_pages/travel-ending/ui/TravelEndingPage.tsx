'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import type { GeneratedApi } from '@packages/shared';
import { useCreateTravelEndingContent, useTravelEndingElements } from '@entities/user';
import { sendToApp } from '@shared/lib/bridge/utils';
import { formatVisitedAt } from '@shared/lib/formatVisitedAt';
import { Toast } from '@shared/ui/Toast';

// 서버 규칙(TravelEndingContentCreateRequest 문서): 방문한 곳/미션/사진 전부 1~3개 필수(요청 검증에서 걸림).
const MIN_SELECT = 1;
const MAX_SELECT = 3;
const CREATE_COST_POINT = 100;
const MIN_LOADING_MS = 3000;
const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

type Step = 'form' | 'loading' | 'result';
type PhotoItem = { id: string; url: string; file: File; selected: boolean };
type ToastState = { id: number; message: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
}

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12.5 5l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warm-neutral-900" />
    </svg>
  );
}

function ChevronDownIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className={`transition-transform ${isOpen ? '' : 'rotate-180'}`}>
      <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-warm-neutral-500" />
    </svg>
  );
}

function CheckMark() {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
      <path d="M1 5L4.2 8.2L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-warm-neutral-400" />
    </svg>
  );
}

function CheckCircle({ checked }: { checked: boolean }) {
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${checked ? 'bg-tertiary-600' : 'bg-cool-neutral-100'}`}>{checked && <CheckMark />}</span>
  );
}

function PointBadge({ point }: { point: number }) {
  return <span className="bg-cool-neutral-100 text-label-sm text-warm-neutral-700 shrink-0 rounded-full px-3 py-1.5 font-medium whitespace-nowrap">{point.toLocaleString()}P 남았어요</span>;
}

function FormHeader({ onBack, onPastMemoriesClick }: { onBack: () => void; onPastMemoriesClick: () => void }) {
  return (
    <div className="flex w-full shrink-0 items-center justify-between px-4" style={{ height: `calc(56px + var(--safe-area-top))`, paddingTop: `var(--safe-area-top)` }}>
      <button type="button" aria-label="뒤로가기" onClick={onBack} className="flex items-center justify-center rounded-full p-1">
        <ChevronLeftIcon />
      </button>
      <button type="button" onClick={onPastMemoriesClick} className="border-cool-neutral-200 text-label-md text-warm-neutral-900 rounded-full border px-4 py-2 font-medium">
        지난 추억
      </button>
    </div>
  );
}

function SectionCard({ title, count, isOpen, onToggle, children }: { title: string; count: number; isOpen: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-cool-neutral-white flex flex-col gap-4 rounded-2xl p-5 shadow-[4px_4px_14px_rgba(0,0,0,0.12)]">
      <button type="button" onClick={onToggle} className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-body-lg text-warm-neutral-900 font-bold">{title}</span>
          <span className="bg-tertiary-100 text-tertiary-800 text-label-sm flex h-6 w-6 items-center justify-center rounded-full font-bold">{count}</span>
        </span>
        <ChevronDownIcon isOpen={isOpen} />
      </button>
      {isOpen && <div className="flex flex-col gap-4">{children}</div>}
    </div>
  );
}

function LocationRow({ location, checked, onToggle, onViewDetail }: { location: GeneratedApi.TravelEndingVisitedLocationResponse; checked: boolean; onToggle: () => void; onViewDetail: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <CheckCircle checked={checked} />
        <span className="text-body-md text-warm-neutral-900 truncate font-medium">{location.locationTitle}</span>
      </button>
      <button type="button" onClick={onViewDetail} className="text-label-sm text-warm-neutral-400 shrink-0 font-medium">
        상세보기
      </button>
    </div>
  );
}

function MissionRow({ mission, checked, onToggle }: { mission: GeneratedApi.TravelEndingCompletedMissionResponse; checked: boolean; onToggle: () => void }) {
  const point = mission.rewardDetail.point;
  const subtitleParts = [mission.completedLocation, formatVisitedAt(mission.completedAt)].filter((part): part is string => Boolean(part));

  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 text-left">
      <CheckCircle checked={checked} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body-md text-warm-neutral-900 truncate font-bold">{mission.missionTitle}</span>
        <span className="text-label-sm text-warm-neutral-400">{subtitleParts.join(' · ')}</span>
      </div>
      {point && <span className="bg-cool-neutral-100 text-label-sm text-warm-neutral-700 shrink-0 rounded-full px-3 py-1 font-medium">{point.amount}P</span>}
    </button>
  );
}

function PhotoGrid({
  photos,
  canAddMore,
  onToggle,
  onAddClick,
  inputRef,
  onFilesChange,
}: {
  photos: PhotoItem[];
  canAddMore: boolean;
  onToggle: (id: string) => void;
  onAddClick: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFilesChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <button key={photo.id} type="button" onClick={() => onToggle(photo.id)} className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className={`h-full w-full object-cover ${photo.selected ? '' : 'opacity-40'}`} />
            {photo.selected && (
              <span className="bg-tertiary-600 absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white">
                <CheckMark />
              </span>
            )}
          </button>
        ))}
        {canAddMore && (
          <button
            type="button"
            onClick={onAddClick}
            className="border-cool-neutral-200 flex h-[104px] w-[104px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed"
          >
            <PlusIcon />
            <span className="text-label-sm text-warm-neutral-400">사진 추가</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFilesChange} className="hidden" />
    </div>
  );
}

function BlurredBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="bg-warm-neutral-200 absolute -top-16 -left-20 h-72 w-72 rounded-full opacity-90 blur-3xl" />
      <div className="bg-warm-neutral-200 absolute top-1/3 -right-24 h-80 w-80 rounded-full opacity-70 blur-3xl" />
      <div className="bg-warm-neutral-200 absolute bottom-0 left-1/4 h-64 w-64 rounded-full opacity-70 blur-3xl" />
      <div className="bg-warm-neutral-200 absolute -right-10 bottom-24 h-56 w-56 rounded-full opacity-60 blur-3xl" />
    </div>
  );
}

function LoadingScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="bg-warm-neutral-50 relative flex h-dvh w-full flex-col overflow-hidden">
      <BlurredBackground />
      <div className="relative z-10 flex w-full shrink-0 items-center px-4" style={{ height: `calc(56px + var(--safe-area-top))`, paddingTop: `var(--safe-area-top)` }}>
        <button type="button" aria-label="뒤로가기" onClick={onBack} className="bg-cool-neutral-white flex h-9 w-9 items-center justify-center rounded-full">
          <ChevronLeftIcon />
        </button>
      </div>
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-2 px-6 pb-24 text-center">
        <p className="text-heading-h4 text-warm-neutral-900 font-bold">로딩중입니다</p>
        <p className="text-body-md text-warm-neutral-600">엽서를 만들고 있어요</p>
      </div>
    </div>
  );
}

function ResultScreen({
  imageUrl,
  isSaving,
  onBack,
  onRetry,
  onSave,
  onShare,
}: {
  imageUrl: string;
  isSaving: boolean;
  onBack: () => void;
  onRetry: () => void;
  onSave: () => void;
  onShare: () => void;
}) {
  return (
    <div className="bg-warm-neutral-50 relative flex h-dvh w-full flex-col overflow-hidden">
      <BlurredBackground />
      <div className="relative z-10 flex w-full shrink-0 items-center justify-between px-4" style={{ height: `calc(56px + var(--safe-area-top))`, paddingTop: `var(--safe-area-top)` }}>
        <button type="button" aria-label="뒤로가기" onClick={onBack} className="bg-cool-neutral-white flex h-9 w-9 items-center justify-center rounded-full">
          <ChevronLeftIcon />
        </button>
        <button type="button" onClick={onShare} className="bg-cool-neutral-white text-label-md text-warm-neutral-900 rounded-full px-5 py-2 font-bold">
          공유
        </button>
      </div>
      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="완성된 여행 엽서" className="w-full max-w-90 rounded-lg object-contain shadow-[0_8px_30px_rgba(0,0,0,0.18)]" />
      </div>
      <div className="relative z-10 flex w-full gap-3 px-4" style={{ paddingBottom: `calc(20px + var(--safe-area-bottom))` }}>
        <button type="button" onClick={onRetry} className="border-cool-neutral-300 bg-cool-neutral-white text-label-lg text-warm-neutral-900 flex-1 rounded-full border py-3.5 font-bold">
          다시 만들기
        </button>
        <button type="button" disabled={isSaving} onClick={onSave} className="bg-cool-neutral-900 text-label-lg text-cool-neutral-white flex-1 rounded-full py-3.5 font-bold disabled:opacity-60">
          저장하기
        </button>
      </div>
    </div>
  );
}

function FormScreen({
  data,
  onBack,
  onSubmit,
  isSubmitting,
  onShowToast,
}: {
  data: GeneratedApi.TravelEndingElementsResponse;
  onBack: () => void;
  onSubmit: (input: { locationIds: number[]; missions: GeneratedApi.TravelEndingMissionRequest[]; photoFiles: File[]; note: string }) => void;
  isSubmitting: boolean;
  onShowToast: (message: string) => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createdUrlsRef = useRef<string[]>([]);

  const [openSections, setOpenSections] = useState({ locations: true, missions: true, photos: true });
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<number>>(() => new Set());
  const [selectedMissionIds, setSelectedMissionIds] = useState<Set<number>>(() => new Set());
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [note, setNote] = useState('');

  // 처음 데이터가 오면 전부 선택된 상태로 시작한다(최대 3개 규칙에 걸리면 앞의 3개만).
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    setSelectedLocationIds(new Set(data.visitedLocations.slice(0, MAX_SELECT).map((location) => location.id)));
    setSelectedMissionIds(new Set(data.completedMissions.slice(0, MAX_SELECT).map((mission) => mission.missionId)));
  }, [data]);

  useEffect(
    () => () => {
      createdUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  function toggleSection(key: keyof typeof openSections) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleLocation(id: number) {
    setSelectedLocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_SELECT) {
          onShowToast(`방문한 곳은 최대 ${MAX_SELECT}개까지 선택할 수 있어요`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  function toggleMission(id: number) {
    setSelectedMissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_SELECT) {
          onShowToast(`미션은 최대 ${MAX_SELECT}개까지 선택할 수 있어요`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  function togglePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((photo) => photo.id === id);
      if (target && !target.selected && prev.filter((photo) => photo.selected).length >= MAX_SELECT) {
        onShowToast(`사진은 최대 ${MAX_SELECT}장까지 선택할 수 있어요`);
        return prev;
      }
      return prev.map((photo) => (photo.id === id ? { ...photo, selected: !photo.selected } : photo));
    });
  }

  function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    const remainingSlots = MAX_SELECT - photos.length;
    const accepted: PhotoItem[] = [];
    for (const file of files) {
      if (accepted.length >= remainingSlots) {
        onShowToast(`사진은 최대 ${MAX_SELECT}장까지 추가할 수 있어요`);
        break;
      }
      if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
        onShowToast('JPEG·PNG·WebP 사진만 추가할 수 있어요');
        continue;
      }
      if (file.size > MAX_PHOTO_SIZE_BYTES) {
        onShowToast('사진 한 장은 10MB를 넘을 수 없어요');
        continue;
      }
      const url = URL.createObjectURL(file);
      createdUrlsRef.current.push(url);
      accepted.push({ id: crypto.randomUUID(), url, file, selected: true });
    }
    if (accepted.length > 0) setPhotos((prev) => [...prev, ...accepted]);
  }

  const selectedPhotoCount = photos.filter((photo) => photo.selected).length;
  const hasEnoughPoint = data.point >= CREATE_COST_POINT;
  const canSubmit =
    !isSubmitting &&
    hasEnoughPoint &&
    selectedLocationIds.size >= MIN_SELECT &&
    selectedMissionIds.size >= MIN_SELECT &&
    selectedPhotoCount >= MIN_SELECT;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      locationIds: Array.from(selectedLocationIds),
      missions: data.completedMissions
        .filter((mission) => selectedMissionIds.has(mission.missionId))
        .map((mission) => ({ missionId: mission.missionId, missionType: mission.missionType })),
      photoFiles: photos.filter((photo) => photo.selected).map((photo) => photo.file),
      note,
    });
  }

  return (
    <div className="bg-warm-neutral-50 relative flex h-dvh w-full flex-col overflow-hidden">
      <FormHeader onBack={onBack} onPastMemoriesClick={() => onShowToast('아직 준비 중이에요')} />

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-28">
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="flex flex-col gap-1">
            <h1 className="text-heading-h3 text-warm-neutral-900 font-bold">엽서에 담을 기록</h1>
            <p className="text-body-sm text-warm-neutral-600">1회 생성 시 {CREATE_COST_POINT}P 차감됩니다.</p>
          </div>
          <PointBadge point={data.point} />
        </div>

        <SectionCard title="방문한 곳" count={data.visitedLocations.length} isOpen={openSections.locations} onToggle={() => toggleSection('locations')}>
          {data.visitedLocations.length === 0 ? (
            <p className="text-label-md text-warm-neutral-400">아직 방문한 곳이 없어요</p>
          ) : (
            data.visitedLocations.map((location) => (
              <LocationRow
                key={location.id}
                location={location}
                checked={selectedLocationIds.has(location.id)}
                onToggle={() => toggleLocation(location.id)}
                onViewDetail={() => router.push(`/map/${location.id}`)}
              />
            ))
          )}
        </SectionCard>

        <SectionCard title="미션" count={data.completedMissions.length} isOpen={openSections.missions} onToggle={() => toggleSection('missions')}>
          {data.completedMissions.length === 0 ? (
            <p className="text-label-md text-warm-neutral-400">아직 완료한 미션이 없어요</p>
          ) : (
            data.completedMissions.map((mission) => (
              <MissionRow key={mission.missionId} mission={mission} checked={selectedMissionIds.has(mission.missionId)} onToggle={() => toggleMission(mission.missionId)} />
            ))
          )}
        </SectionCard>

        <SectionCard title="사진" count={selectedPhotoCount} isOpen={openSections.photos} onToggle={() => toggleSection('photos')}>
          <PhotoGrid
            photos={photos}
            canAddMore={photos.length < MAX_SELECT}
            onToggle={togglePhoto}
            onAddClick={() => fileInputRef.current?.click()}
            inputRef={fileInputRef}
            onFilesChange={handleFilesChange}
          />
        </SectionCard>

        <div className="flex flex-col gap-2">
          <label className="text-body-md text-warm-neutral-900 font-bold">여행 한 줄 쓰기 (선택)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="이번 여행을 한 줄로 남겨보세요"
            rows={2}
            className="border-cool-neutral-200 text-body-md text-warm-neutral-900 placeholder:text-cool-neutral-400 resize-none rounded-2xl border px-4 py-3.5 outline-none"
          />
        </div>
      </div>

      <div className="bg-warm-neutral-50 absolute inset-x-0 bottom-0 px-4 pt-3" style={{ paddingBottom: `calc(16px + var(--safe-area-bottom))` }}>
        <button type="button" disabled={!canSubmit} onClick={handleSubmit} className="bg-cool-neutral-900 text-label-lg text-cool-neutral-white w-full rounded-full py-4 font-bold disabled:opacity-40">
          AI 엽서 만들기
        </button>
      </div>
    </div>
  );
}

export function TravelEndingPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useTravelEndingElements();
  const { mutateAsync: createTravelEndingContent, isPending } = useCreateTravelEndingContent();

  const [step, setStep] = useState<Step>('form');
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  function showToast(message: string) {
    setToast({ id: Date.now(), message });
  }

  async function handleSubmit(input: { locationIds: number[]; missions: GeneratedApi.TravelEndingMissionRequest[]; photoFiles: File[]; note: string }) {
    setStep('loading');
    const startedAt = Date.now();

    try {
      const result = await createTravelEndingContent({
        visitedLocationIds: input.locationIds,
        missions: input.missions,
        photos: input.photoFiles,
        travelNote: input.note.trim() || null,
      });

      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_LOADING_MS) await sleep(MIN_LOADING_MS - elapsed);

      setResultImageUrl(result.imageUrl);
      setStep('result');
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_LOADING_MS) await sleep(MIN_LOADING_MS - elapsed);

      Sentry.captureException(error instanceof Error ? error : new Error(`travel ending content create failed: ${String(error)}`));
      setStep('form');
      showToast('엽서를 만들지 못했어요. 다시 시도해주세요');
    }
  }

  async function handleSave() {
    if (!resultImageUrl || isSaving) return;
    setIsSaving(true);
    try {
      const response = await fetch(resultImageUrl);
      const blob = await response.blob();
      const dataUrl = await readAsDataUrl(blob);
      sendToApp({ type: 'SAVE_IMAGE', payload: { dataUrl, fileName: `tamnalog-postcard-${Date.now()}` } });
      showToast('갤러리에 저장을 요청했어요');
    } catch (error) {
      Sentry.captureException(error instanceof Error ? error : new Error(`postcard save failed: ${String(error)}`));
      showToast('저장하지 못했어요. 다시 시도해주세요');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleShare() {
    if (!resultImageUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: '잠깐제주 여행 엽서', url: resultImageUrl });
      } catch {
        // 사용자가 공유를 취소한 경우 등 — 별도 처리 없음
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(resultImageUrl);
      showToast('링크를 복사했어요');
    } catch {
      showToast('공유를 지원하지 않는 환경이에요');
    }
  }

  if (isLoading) {
    return <p className="text-body-sm text-warm-neutral-600 w-full px-4 py-12 text-center">불러오는 중...</p>;
  }
  if (isError || !data) {
    return <p className="text-body-sm text-warm-neutral-600 w-full px-4 py-12 text-center">불러오지 못했어요. 다시 시도해주세요</p>;
  }

  return (
    <>
      {step === 'form' && <FormScreen data={data} onBack={() => router.push('/mypage')} onSubmit={handleSubmit} isSubmitting={isPending} onShowToast={showToast} />}
      {step === 'loading' && <LoadingScreen onBack={() => setStep('form')} />}
      {step === 'result' && resultImageUrl && (
        <ResultScreen imageUrl={resultImageUrl} isSaving={isSaving} onBack={() => router.push('/mypage')} onRetry={() => setStep('form')} onSave={handleSave} onShare={handleShare} />
      )}
      {toast && <Toast key={toast.id} message={toast.message} onDone={() => setToast(null)} />}
    </>
  );
}
