'use client';

import { PHOTO_ICON_CONTENT } from '@shared/lib/photoIcon';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseGuestbookWriteParams, useCreateGuestbook } from '@entities/guestbook';
import { GeneratedApi } from '@packages/shared';
import { isAppWebView, sendToApp } from '@shared/lib/bridge/utils';
import { useIsKeyboardOpen, useKeyboardInset } from '@shared/lib/interaction/useKeyboardInset';
import travelNoteCompleteMark from '@shared/lib/images/travel-note-complete-mark.png';
import { isInitialPathname, readCanGoBack, resolveBackTarget } from '@shared/lib/navigationHistory';
import { Toast } from '@shared/ui/Toast';
import { hasAnyGuestbookContent } from '../model/guestbookContentDraft';

type ToolKey = 'text' | 'photo' | 'sound' | 'weather' | 'color';

/**
 * 작성 화면은 두 단계다. 1단계는 방명록 내용을 만들고(바텀시트), 2단계는 만든 방명록을 보면서
 * 장소·날짜만 적는다. 저장 payload는 단계와 무관하게 예전 그대로 한 번에 만들어 보낸다.
 *
 * 라우트를 나누지 않고 한 컴포넌트의 상태로 둔 이유: 사진·소리의 blob URL 수명이 이 컴포넌트의
 * 언마운트에 묶여 있다(createdPhotoUrlsRef). 단계마다 페이지를 갈아끼우면 1단계를 떠나는 순간
 * blob이 해제돼 2단계 미리보기의 사진이 깨진다. 상태 전환이면 뒤로가기 preset도 공짜로 따라온다.
 */
type WriteStep = 'content' | 'place';

const mock = {
  title: '방명록 남기기',
  nextLabel: '다음',
  photoPickerLabel: '사진 추가하기',
  contentPlaceholder: '후기를 작성해주세요.',
};

/**
 * 내용을 화면 가운데에 두되, 넘치면 스크롤되게 하는 영역.
 *
 * justify-center가 아닌 이유: flex 가운데 정렬은 내용이 넘치는 순간 **위쪽이 잘려** 스크롤로도 닿을
 * 수 없게 된다. 첫·마지막 자식의 auto 마진은 자리가 남을 때만 가운데를 만들고, 모자라면 0으로 접혀
 * 평범한 스크롤이 된다 — 하단 CTA는 어느 쪽이든 이 영역 위에 고정이다.
 */
/**
 * 헤더가 차지하는 높이.
 *
 * 시트 뒷배경이 **여기서부터** 시작한다. 화면 전체(inset-0)를 덮으면 시트가 열려 있는 동안 헤더의
 * "다음"을 누른 첫 탭이 뒷배경에 먹혀 시트만 닫히고, 한 번 더 눌러야 넘어간다. 층(z-index)을 올려
 * 피하지 않는 이유는, 그러면 키보드로 시트가 헤더까지 올라왔을 때 헤더가 시트를 뚫고 나오기 때문이다.
 */
const HEADER_HEIGHT = 'calc(56px + var(--safe-area-top))';

const CENTERED_SCROLL_AREA = 'overflow-y-auto [&>*:first-child]:mt-auto [&>*:last-child]:mb-auto';

// 오늘 날짜를 <input type="date"> 값 포맷(YYYY-MM-DD)으로 반환 — 로컬 타임존 기준.
function getTodayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// YYYY-MM-DD 값을 달력 계산에 쓰기 편한 형태로 분해한다(month는 Date 규칙대로 0-indexed).
function parseDateInputValue(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month: month - 1, day };
}

function formatDateInputValue(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 해당 월 1일의 요일만큼 앞을 비워, 실제 달력처럼 요일이 맞게 배열되는 셀 목록을 만든다.
function getCalendarCells(year: number, month: number): (number | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
}

const TOOL_MENU: { key: ToolKey; label: string }[] = [
  { key: 'text', label: '글' },
  { key: 'photo', label: '사진' },
  { key: 'sound', label: '소리' },
  { key: 'weather', label: '날씨' },
  { key: 'color', label: '컬러' },
];

const WAVEFORM_BARS = [8, 14, 10, 16, 6, 12, 15, 9, 17, 11, 13, 7, 15, 10, 14, 8];

// file이 null이면 앱 번들 기본 제공 mock 오디오, 있으면 사용자가 직접 가져온 오디오다.
type SoundItem = { id: string; label: string; url: string; file: File | null };

// 사용자가 아직 아무 파일도 안 가져왔을 때를 위한 기본 제공 mock 오디오 1개(요구사항).
const DEFAULT_MOCK_SOUND: SoundItem = { id: 'mock-default', label: '2026.08.29', url: '/audios/mock-audio-01.mp3', file: null };

const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// 멀티파트 업로드 용량을 적당히 제한한다(음성 메모 수준의 짧은 녹음을 기준으로 넉넉히 잡은 값).
const MAX_SOUND_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// 오디오 MIME 타입은 기기·브라우저마다 보고값이 갈려(특히 m4a/aac) 확장자도 함께 본다.
const ACCEPTED_SOUND_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/x-aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm'];
const ACCEPTED_SOUND_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.webm'];

function isAcceptedSoundFile(file: File): boolean {
  if (ACCEPTED_SOUND_TYPES.includes(file.type)) return true;
  const lowerName = file.name.toLowerCase();
  return ACCEPTED_SOUND_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function formatAudioDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '00:00';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// 오디오 메타데이터만 미리 불러와 실제 재생시간을 표시용으로 계산한다(재생 자체와는 무관).
function useAudioDuration(url: string): string | null {
  const [duration, setDuration] = useState<string | null>(null);
  // url이 바뀔 때 이전 재생시간을 이펙트가 아니라 렌더링 중에 리셋한다
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes) — 이펙트 안에서 곧바로 setState를 부르면 불필요한 추가 렌더가 발생한다.
  const [prevUrl, setPrevUrl] = useState(url);
  if (url !== prevUrl) {
    setPrevUrl(url);
    setDuration(null);
  }

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = url;

    function handleLoadedMetadata() {
      setDuration(formatAudioDuration(audio.duration));
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
  }, [url]);

  return duration;
}

const WEATHER_OPTIONS: { key: string; emoji: string; label: string }[] = [
  { key: 'sunny', emoji: '☀️', label: '맑음' },
  { key: 'rain', emoji: '🌧️', label: '비' },
  { key: 'cloudy', emoji: '⛅', label: '흐림' },
  { key: 'snow', emoji: '❄️', label: '눈' },
];

const COLOR_OPTIONS: { key: string; hex: string }[] = [
  { key: 'blue', hex: '#bfe6f8' },
  { key: 'orange', hex: '#fbd9ad' },
  { key: 'green', hex: '#cbe7b1' },
  { key: 'yellow', hex: '#fbe884' },
  { key: 'white', hex: '#ffffff' },
];

function IconChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M12.5 5l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warm-neutral-900" />
    </svg>
  );
}

function IconPhoto() {
  // 서버·사용자 입력이 아닌 기존 고정 SVG 도형만 재사용한다.
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" dangerouslySetInnerHTML={{ __html: PHOTO_ICON_CONTENT }} />;
}

function IconText() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4.5 4.5h11M10 4.5v11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconSound() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 8v4h2.5l3.5 2.8V5.2L6 8H3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M13 7.3a3.3 3.3 0 010 5.4M15 5a6 6 0 010 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconWeather() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6.3 14.2a2.9 2.9 0 01-.4-5.8A3.7 3.7 0 0113.3 7.6a3.1 3.1 0 01.5 6.6H6.3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconColor() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2.5c2.9 3.3 5 6 5 8.3a5 5 0 01-10 0c0-2.3 2.1-5 5-8.3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="18" height="18" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 1.5v9l7-4.5-7-4.5z" fill="currentColor" className="text-cool-neutral-white" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="18" height="18" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="2" y="1.5" width="3" height="9" rx="1" fill="currentColor" className="text-cool-neutral-white" />
      <rect x="7" y="1.5" width="3" height="9" rx="1" fill="currentColor" className="text-cool-neutral-white" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 7h13M6 2v3M12 2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronUp() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
      <path d="M1 4.5L5 1l4 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
      <path d="M1 1.5L5 5l4-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TOOL_ICONS = {
  text: IconText,
  photo: IconPhoto,
  sound: IconSound,
  weather: IconWeather,
  color: IconColor,
};

/**
 * "다음"은 **헤더 오른쪽 위**가 제자리다(디자인 원안). 하단 CTA로 내렸다가 되돌린 것은,
 * 2단계의 "저장완료"만 하단에 서고 1단계는 상단에서 넘어가는 것이 원래 화면 구성이기 때문이다.
 *
 * next가 null이면 칩을 그리지 않는다 — 2단계에는 "다음"이 없다. 제목이 남아 있을 때만 같은 폭의
 * 빈 칸으로 균형을 맞춘다(가운데 제목이 왼쪽으로 쏠리는 걸 막는 용도라 제목이 없으면 필요 없다).
 *
 * title이 null이면 제목도 그리지 않는다 — 2단계는 만들어진 방명록을 보는 화면이라 제목을 뺀다.
 */
function Header({ onBack, title, next }: { onBack: () => void; title: string | null; next: { disabled: boolean; onClick: () => void } | null }) {
  return (
    <div className="relative flex w-full shrink-0 items-center justify-between px-4" style={{ height: HEADER_HEIGHT, paddingTop: `var(--safe-area-top)` }}>
      <button type="button" aria-label="뒤로가기" onClick={onBack} className="flex items-center justify-center rounded-full p-1">
        <IconChevronLeft />
      </button>
      {title && <span className="text-heading-h4 text-warm-neutral-900 absolute left-1/2 -translate-x-1/2 font-bold">{title}</span>}
      {next ? (
        // 색으로 상태를 말한다 — "내용을 하나라도 넣어야 넘어간다"를 알려야 해서다(InquiryModal과 같은 전환)
        <button
          type="button"
          disabled={next.disabled}
          onClick={next.onClick}
          className={`text-label-md text-cool-neutral-white rounded-full px-3 py-2 font-bold transition-colors ${next.disabled ? 'bg-cool-neutral-400' : 'bg-tertiary-600'}`}
        >
          {mock.nextLabel}
        </button>
      ) : title ? (
        <span aria-hidden="true" className="h-6 w-6" />
      ) : null}
    </div>
  );
}

function SoundPreviewChip({ sound }: { sound: SoundItem }) {
  const duration = useAudioDuration(sound.url);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  function handleToggle(e: ReactMouseEvent) {
    e.stopPropagation(); // 카드 클릭(시트 열기)으로 전파되지 않도록
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.currentTime = 0;
      void audio.play();
    }
  }

  return (
    <div className="border-cool-neutral-200 bg-cool-neutral-white flex items-center gap-2.5 rounded-2xl border px-3 py-2">
      {/* 미리듣기 재생 전용 — 화면에는 노출하지 않는다 */}
      <audio ref={audioRef} src={sound.url} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} className="hidden" />
      <button type="button" aria-label={isPlaying ? '일시정지' : '재생'} onClick={handleToggle} className="bg-cool-neutral-900 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
        {isPlaying ? <IconPause /> : <IconPlay />}
      </button>
      <div className="flex h-3 flex-1 items-end gap-0.5" aria-hidden="true">
        {WAVEFORM_BARS.map((height, index) => (
          <span key={index} className="bg-cool-neutral-300 w-0.5 flex-1 rounded-full" style={{ height: `${Math.max(4, Math.round(height * 0.5))}px` }} />
        ))}
      </div>
      <span className="text-label-sm text-cool-neutral-950 font-bold">{duration ?? '--:--'}</span>
    </div>
  );
}

// <input type="date"> 값(YYYY-MM-DD)을 표시용 포맷(YYYY.MM.DD)으로 변환
function formatVisitedAtDots(visitedAt: string): string {
  return visitedAt.replaceAll('-', '.');
}

type PreviewCardProps = {
  /** null이면 눌러도 편집 시트가 열리지 않는다(2단계는 만들어진 방명록을 보여주기만 한다) */
  onOpenSheet: (() => void) | null;
  contentWriting: string;
  selectedPhotoUrl: string | null;
  selectedSound: SoundItem | null;
  contentWeather: string | null;
  contentTemperature: number;
  contentColorCode: string | null;
};

function PreviewCard({ onOpenSheet, contentWriting, selectedPhotoUrl, selectedSound, contentWeather, contentTemperature, contentColorCode }: PreviewCardProps) {
  const weatherOption = contentWeather ? WEATHER_OPTIONS.find((option) => option.label === contentWeather) : null;
  /**
   * 2단계는 **만들어진 방명록을 보여주기만** 한다. 그래서 자리표시를 그리지 않는다 —
   * "사진을 골라주세요" 같은 안내는 누를 수 있을 때만 뜻이 있고, 누를 수 없는 화면에 남으면
   * 넣지 않은 것이 마치 빠뜨린 것처럼 보인다. 넣지 않은 항목은 그대로 비워 둔다.
   */
  const isReadOnly = onOpenSheet === null;
  const openProps = onOpenSheet ? { role: 'button', tabIndex: 0, onClick: onOpenSheet, onKeyDown: (e: ReactKeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && onOpenSheet() } : {};

  return (
    <div className="w-full px-5">
      <div className="rounded-2xl bg-white p-2">
        {/* 두 단계 모두 높이는 **하한만** 둔다 — 내용이 길면 그만큼 늘어난다.
            1단계(320)가 2단계(240)보다 큰 것은, 아직 빈 카드라 눌러 볼 자리가 넉넉해야 하기 때문이다 */}
        <div
          {...openProps}
          className={`bg-tertiary-100 flex w-full flex-col gap-4 rounded-2xl p-3 ${onOpenSheet ? 'min-h-80 cursor-pointer' : 'min-h-65'}`}
          style={contentColorCode ? { backgroundColor: contentColorCode } : undefined}
        >
          {!(isReadOnly && !selectedPhotoUrl) && (
            <div className="border-tertiary-100 relative flex aspect-square h-42.5 w-full items-center justify-center overflow-hidden rounded-xl border bg-[repeating-conic-gradient(#fafafa_0%_25%,#ebebeb_0%_50%)] bg-size-[30px_30px]">
              {selectedPhotoUrl ? (
                // 사용자가 방금 사진첩에서 고른 로컬 blob 이미지라 next/image 최적화 대상이 아니다.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedPhotoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2.5">
                  <div className="bg-cool-neutral-900 flex h-14 w-14 items-center justify-center rounded-full">
                    {/* 글리프만 1.5배(20 -> 30). 아이콘 컴포넌트를 직접 키우면 도구 메뉴의 같은 아이콘까지 따라 커진다 */}
                    <span className="text-cool-neutral-white [&_svg]:h-7.5 [&_svg]:w-7.5">
                      <IconPhoto />
                    </span>
                  </div>
                  <span className="text-label-md text-cool-neutral-950 font-bold">{mock.photoPickerLabel}</span>
                </div>
              )}
            </div>
          )}
          {weatherOption && (
            <span className="border-cool-neutral-200 bg-cool-neutral-white text-label-sm text-warm-neutral-900 flex w-fit items-center gap-1 rounded-full border px-3 py-1.5 font-medium">
              {weatherOption.emoji} {contentTemperature}°C {weatherOption.label}
            </span>
          )}
          {!(isReadOnly && !contentWriting) && (
            <p className={`text-body-md w-full break-words whitespace-pre-wrap ${contentWriting ? 'text-warm-neutral-900' : 'text-warm-neutral-500'}`}>{contentWriting || mock.contentPlaceholder}</p>
          )}
          {selectedSound && <SoundPreviewChip sound={selectedSound} />}
        </div>
      </div>
    </div>
  );
}

function ToolMenu({ activeTab, onSelect, isCompact }: { activeTab: ToolKey; onSelect: (tab: ToolKey) => void; isCompact: boolean }) {
  return (
    <div className="flex w-full items-start justify-between px-6">
      {TOOL_MENU.map((item) => {
        const Icon = TOOL_ICONS[item.key];
        const isActive = item.key === activeTab;
        return (
          <button key={item.key} type="button" onClick={() => onSelect(item.key)} className="flex flex-col items-center gap-1.5">
            {/* 글리프만 1.5배(20 -> 30)로 키운다. 아이콘 컴포넌트의 width/height를 직접 올리면
                같은 아이콘을 쓰는 미리보기 카드까지 함께 커지므로 여기서만 덮어쓴다. */}
            <span
              className={`flex items-center justify-center rounded-full ${isCompact ? 'h-10 w-10 [&_svg]:h-5 [&_svg]:w-5' : 'h-14 w-14 [&_svg]:h-7.5 [&_svg]:w-7.5'} ${isActive ? 'bg-cool-neutral-900 text-cool-neutral-white' : 'bg-cool-neutral-100 text-cool-neutral-400'}`}
            >
              <Icon />
            </span>
            {!isCompact && <span className={`text-label-sm ${isActive ? 'text-cool-neutral-950 font-bold' : 'text-cool-neutral-400 font-medium'}`}>{item.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

const CONTENT_WRITING_MAX_LENGTH = 50;

function TextTabContent({ value, onChange, isCompact }: { value: string; onChange: (value: string) => void; isCompact: boolean }) {
  return (
    <div className="flex w-full flex-col gap-3 px-6">
      <p className="text-label-md text-cool-neutral-950 font-bold">글 남기기</p>
      <div className="border-cool-neutral-200 relative rounded-2xl border p-4">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, CONTENT_WRITING_MAX_LENGTH))}
          placeholder="여기에 후기를 작성할 수 있어요."
          // 시트 높이가 h-84로 고정이라 이 칸이 커지면 아래 여백(안전영역 포함)을 그대로 먹는다.
          // 글자 수 상한이 50자라 3줄이면 넘치지 않고, 키보드가 덮는 동안에는 두 줄로 줄인다.
          rows={isCompact ? 2 : 3}
          maxLength={CONTENT_WRITING_MAX_LENGTH}
          className="text-body-md text-warm-neutral-900 placeholder:text-cool-neutral-400 w-full resize-none border-0 p-0 pb-5 outline-none"
        />
        <span className="text-label-sm text-cool-neutral-400 absolute right-4 bottom-3">
          {value.length}/{CONTENT_WRITING_MAX_LENGTH}
        </span>
      </div>
    </div>
  );
}

type PhotoItem = { id: string; url: string; file: File };

function PhotoPicker({ photos, selectedId, onSelect, onAddPhotos }: { photos: PhotoItem[]; selectedId: string | null; onSelect: (id: string) => void; onAddPhotos: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFilesChange(e: ReactChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onAddPhotos(files);
    e.target.value = ''; // 같은 파일을 다시 선택해도 onChange가 발생하도록 초기화
  }

  return (
    <div className="flex w-full flex-col gap-3 px-6">
      <div className="flex items-center justify-between">
        <p className="text-label-md text-cool-neutral-950 font-bold">찍어둔 사진 선택하기</p>
        <button type="button" onClick={() => inputRef.current?.click()} className="text-label-sm text-tertiary-600 font-semibold">
          사진첩에서 가져오기
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFilesChange} className="hidden" />
      {photos.length === 0 ? (
        <p className="text-label-md text-cool-neutral-400">아직 선택한 사진이 없어요</p>
      ) : (
        <div className="flex w-full items-center gap-3 overflow-x-auto p-1">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              aria-label="사진 선택"
              onClick={() => onSelect(photo.id)}
              className={'bg-cool-neutral-100 relative h-24 w-24 shrink-0 overflow-hidden rounded-lg' + (photo.id === selectedId ? ' ring-cool-neutral-950 ring-2 ring-offset-2' : '')}
            >
              {/* 사용자가 방금 사진첩에서 고른 로컬 blob 이미지라 next/image 최적화 대상이 아니다. */}
              {/* object-cover로 채우면 세로로 긴 사진의 위아래가 박스 밖으로 잘려나가므로, 잘리지 않게 전체를 다 보여준다. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SoundRow({
  sound,
  isSelected,
  isPlaying,
  onSelect,
  onTogglePlay,
}: {
  sound: SoundItem;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: () => void;
  onTogglePlay: (e: ReactMouseEvent) => void;
}) {
  const duration = useAudioDuration(sound.url);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label-sm text-cool-neutral-400">{sound.label}</span>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
        className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 ${isSelected ? 'border-tertiary-500 bg-tertiary-50' : 'border-cool-neutral-200'}`}
      >
        <button type="button" aria-label={isPlaying ? '일시정지' : '재생'} onClick={onTogglePlay} className="bg-cool-neutral-900 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          {isPlaying ? <IconPause /> : <IconPlay />}
        </button>
        <div className="flex h-4 flex-1 items-end gap-0.5" aria-hidden="true">
          {/* TODO: 실제 파형 데이터 교체 */}
          {WAVEFORM_BARS.map((height, index) => (
            <span key={index} className="bg-cool-neutral-300 w-0.5 flex-1 rounded-full" style={{ height: `${height}px` }} />
          ))}
        </div>
        <span className="text-label-md text-cool-neutral-950 font-bold">{duration ?? '--:--'}</span>
      </div>
    </div>
  );
}

function SoundTabContent({ sounds, selectedId, onSelect, onAddSounds }: { sounds: SoundItem[]; selectedId: string | null; onSelect: (id: string) => void; onAddSounds: (files: File[]) => void }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleTogglePlay(e: ReactMouseEvent, sound: SoundItem) {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (playingId === sound.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }

    audio.src = sound.url;
    audio.currentTime = 0;
    void audio.play();
    setPlayingId(sound.id);
  }

  function handleFilesChange(e: ReactChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onAddSounds(files);
    e.target.value = ''; // 같은 파일을 다시 선택해도 onChange가 발생하도록 초기화
  }

  return (
    <div className="flex w-full flex-col gap-4 px-6">
      {/* 미리듣기 재생 전용 — 화면에는 노출하지 않는다 */}
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} className="hidden" />
      <div className="flex items-center justify-between">
        <p className="text-label-md text-cool-neutral-950 font-bold">담아둔 소리 선택하기</p>
        <button type="button" onClick={() => inputRef.current?.click()} className="text-label-sm text-tertiary-600 font-semibold">
          파일에서 가져오기
        </button>
      </div>
      <input ref={inputRef} type="file" accept="audio/mpeg,audio/mp4,.m4a,audio/aac,audio/wav,audio/ogg,audio/webm" multiple onChange={handleFilesChange} className="hidden" />
      <div className="flex flex-col gap-4">
        {sounds.map((sound) => (
          <SoundRow
            key={sound.id}
            sound={sound}
            isSelected={sound.id === selectedId}
            isPlaying={sound.id === playingId}
            onSelect={() => onSelect(sound.id)}
            onTogglePlay={(e) => handleTogglePlay(e, sound)}
          />
        ))}
      </div>
    </div>
  );
}

// 체감상 말이 되는 온도 범위로만 조절 가능하게 제한
const TEMPERATURE_MIN = -20;
const TEMPERATURE_MAX = 45;

function WeatherTabContent({
  temperature,
  onChangeTemperature,
  onOpenTemperatureSheet,
  selectedLabel,
  onSelect,
}: {
  temperature: number;
  onChangeTemperature: (temperature: number) => void;
  onOpenTemperatureSheet: () => void;
  selectedLabel: string | null;
  onSelect: (label: string) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-4 px-6">
      <p className="text-label-md text-cool-neutral-950 font-bold">날씨 선택하기</p>
      {/* 화살표로도 1도씩 조절 가능하지만, 이 영역 자체를 누르면 큰 숫자 목록을 스크롤해서 바로 고를 수 있다.
          화살표는 자체 동작이 있으므로 stopPropagation으로 바텀시트가 함께 열리지 않게 막는다. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenTemperatureSheet}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpenTemperatureSheet()}
        className="bg-cool-neutral-50 flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-4"
      >
        <span className="text-heading-h3 text-cool-neutral-950 font-bold">{temperature}°C</span>
        <div className="text-cool-neutral-400 flex flex-col items-center gap-1">
          <button
            type="button"
            aria-label="온도 올리기"
            disabled={temperature >= TEMPERATURE_MAX}
            onClick={(e) => {
              e.stopPropagation();
              onChangeTemperature(Math.min(TEMPERATURE_MAX, temperature + 1));
            }}
            className="flex h-3 w-6 items-center justify-center disabled:opacity-30"
          >
            <IconChevronUp />
          </button>
          <button
            type="button"
            aria-label="온도 내리기"
            disabled={temperature <= TEMPERATURE_MIN}
            onClick={(e) => {
              e.stopPropagation();
              onChangeTemperature(Math.max(TEMPERATURE_MIN, temperature - 1));
            }}
            className="flex h-3 w-6 items-center justify-center disabled:opacity-30"
          >
            <IconChevronDown />
          </button>
        </div>
      </div>
      {/* 왼쪽 정렬 + 간격 8px. 화면보다 넓으면 가로 스크롤 */}
      <div className="overflow-x-auto">
        <div className="flex w-max gap-2">
          {WEATHER_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onSelect(option.label)}
              // 선택 2px / 미선택 1px. 미선택은 안쪽 여백을 1px씩 더해 두 상태의 바깥 크기를 같게 둔다(선택할 때 흔들림 방지)
              className={`text-label-md flex shrink-0 items-center gap-1.5 rounded-full font-medium ${
                option.label === selectedLabel
                  ? 'border-tertiary-500 bg-tertiary-50 text-cool-neutral-950 border-2 px-3 py-2.5'
                  : 'border-cool-neutral-200 text-cool-neutral-600 border px-[13px] py-[11px]'
              }`}
            >
              <span aria-hidden="true">{option.emoji}</span>
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// 온도 값을 누르면 뜨는 바텀시트 — 화살표로 1도씩 맞추는 대신, 전체 범위를 큰 목록으로 스크롤해서 바로 고를 수 있게 한다.
function TemperatureSheet({ isOpen, temperature, onSelect, onClose }: { isOpen: boolean; temperature: number; onSelect: (value: number) => void; onClose: () => void }) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) selectedRef.current?.scrollIntoView({ block: 'center' });
  }, [isOpen]);

  const values = Array.from({ length: TEMPERATURE_MAX - TEMPERATURE_MIN + 1 }, (_, i) => TEMPERATURE_MIN + i);

  return (
    <>
      {isOpen && <div className="fixed inset-x-0 bottom-0 z-10" style={{ top: HEADER_HEIGHT }} onClick={onClose} />}
      <div
        className="bg-cool-neutral-white fixed inset-x-0 bottom-0 z-10 flex w-full flex-col items-center gap-4 rounded-t-4xl pt-2.5 shadow-[0_-6px_34px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-out"
        style={{ transform: isOpen ? 'translateY(0px)' : 'translateY(100%)', paddingBottom: `max(24px, var(--safe-area-bottom))` }}
      >
        <div aria-hidden="true" className="bg-cool-neutral-200 h-1 w-10 shrink-0 rounded-full" />
        <p className="text-label-lg text-cool-neutral-950 font-bold">온도 선택</p>
        <div className="max-h-70 w-full overflow-y-auto px-6">
          {values.map((value) => {
            const isSelected = value === temperature;
            return (
              <button
                key={value}
                ref={isSelected ? selectedRef : undefined}
                type="button"
                onClick={() => onSelect(value)}
                className={`text-body-lg flex h-12 w-full items-center justify-center rounded-xl ${isSelected ? 'bg-tertiary-50 text-tertiary-600 font-bold' : 'text-warm-neutral-900 font-medium'}`}
              >
                {value}°C
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function ColorTabContent({ selectedHex, onSelect }: { selectedHex: string | null; onSelect: (hex: string) => void }) {
  return (
    <div className="flex w-full flex-col gap-4 px-6">
      <p className="text-label-md text-cool-neutral-950 font-bold">컬러 선택하기</p>
      <div className="flex gap-3">
        {COLOR_OPTIONS.map((color) => (
          <button
            key={color.key}
            type="button"
            aria-label={`${color.key} 컬러 선택`}
            onClick={() => onSelect(color.hex)}
            style={{ backgroundColor: color.hex }}
            className={`border-cool-neutral-200 h-12 w-12 shrink-0 rounded-full border ${color.hex === selectedHex ? 'ring-tertiary-600 ring-2 ring-offset-2' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

type SheetContentState = {
  contentWriting: string;
  onChangeContentWriting: (value: string) => void;
  photos: PhotoItem[];
  selectedPhotoId: string | null;
  onSelectPhoto: (id: string) => void;
  onAddPhotos: (files: File[]) => void;
  sounds: SoundItem[];
  selectedSoundId: string | null;
  onSelectSound: (id: string) => void;
  onAddSounds: (files: File[]) => void;
  contentTemperature: number;
  onChangeContentTemperature: (temperature: number) => void;
  onOpenTemperatureSheet: () => void;
  contentWeather: string | null;
  onSelectContentWeather: (label: string) => void;
  contentColorCode: string | null;
  onSelectContentColorCode: (hex: string) => void;
};

function SheetBody({ activeTab, content, isCompact }: { activeTab: ToolKey; content: SheetContentState; isCompact: boolean }) {
  switch (activeTab) {
    case 'text':
      return <TextTabContent value={content.contentWriting} onChange={content.onChangeContentWriting} isCompact={isCompact} />;
    case 'photo':
      return <PhotoPicker photos={content.photos} selectedId={content.selectedPhotoId} onSelect={content.onSelectPhoto} onAddPhotos={content.onAddPhotos} />;
    case 'sound':
      return <SoundTabContent sounds={content.sounds} selectedId={content.selectedSoundId} onSelect={content.onSelectSound} onAddSounds={content.onAddSounds} />;
    case 'weather':
      return (
        <WeatherTabContent
          temperature={content.contentTemperature}
          onChangeTemperature={content.onChangeContentTemperature}
          onOpenTemperatureSheet={content.onOpenTemperatureSheet}
          selectedLabel={content.contentWeather}
          onSelect={content.onSelectContentWeather}
        />
      );
    case 'color':
      return <ColorTabContent selectedHex={content.contentColorCode} onSelect={content.onSelectContentColorCode} />;
  }
}

// 핸들 바를 이만큼(px) 이상 아래로 끌어내리면 시트를 닫는다.
const SHEET_DRAG_CLOSE_THRESHOLD = 100;

function BottomToolSheet({
  isOpen,
  activeTab,
  onSelectTab,
  content,
  onClose,
}: {
  isOpen: boolean;
  activeTab: ToolKey;
  onSelectTab: (tab: ToolKey) => void;
  content: SheetContentState;
  onClose: () => void;
}) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number | null>(null);
  // 텍스트 탭의 textarea에 포커스가 가면 소프트 키보드가 시트를 가리므로, 키보드 높이만큼 시트를 밀어올린다.
  const keyboardInset = useKeyboardInset();
  /**
   * 키보드가 떠 있는 동안에는 시트를 줄인다.
   *
   * 높이가 h-84(336px)로 고정인데 앱은 키보드 높이만큼 WebView를 줄이므로, 남은 화면의 대부분을
   * 시트가 차지해 뒤의 카드가 거의 보이지 않았다. 고정 높이를 풀어 내용만큼만 쓰고, 도구 메뉴는
   * 글자 없이 작은 원으로, 글 칸은 두 줄로 줄인다 — 탭 전환은 그대로 되어야 하므로 메뉴 자체는 남긴다.
   */
  const isKeyboardOpen = useIsKeyboardOpen();

  function handleDragStart(e: ReactPointerEvent<HTMLDivElement>) {
    dragStartYRef.current = e.clientY;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleDragMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragStartYRef.current == null) return;
    setDragY(Math.max(0, e.clientY - dragStartYRef.current));
  }

  function handleDragEnd() {
    if (dragStartYRef.current == null) return;
    dragStartYRef.current = null;
    setIsDragging(false);
    if (dragY > SHEET_DRAG_CLOSE_THRESHOLD) onClose();
    setDragY(0);
  }

  return (
    <>
      {isOpen && <div className="fixed inset-x-0 bottom-0 z-10" style={{ top: HEADER_HEIGHT }} onClick={onClose} />}
      <div
        className={`bg-cool-neutral-white fixed inset-x-0 bottom-0 z-10 flex w-full flex-col items-center rounded-t-4xl pt-2.5 shadow-[0_-6px_34px_rgba(0,0,0,0.1)] ${
          isKeyboardOpen ? 'gap-4' : 'h-84 gap-6'
        } ${isDragging ? '' : 'transition-[transform,bottom] duration-300 ease-out'}`}
        style={{
          transform: isOpen ? `translateY(${dragY}px)` : 'translateY(100%)',
          bottom: keyboardInset,
          // 형제 시트들(TemperatureSheet·DateCalendarSheet)과 같은 규칙으로 홈 인디케이터를 피한다 —
          // 여기만 고정 pb-6이라 기기에서 마지막 줄이 인디케이터에 닿았다.
          // 키보드가 올라와 시트가 떠 있는 동안에는 가릴 것이 없으므로 기본 여백만 둔다.
          paddingBottom: keyboardInset > 0 ? '24px' : 'max(24px, var(--safe-area-bottom))',
        }}
      >
        {/* 잡는 면은 손잡이 막대가 아니라 **상단 띠 전체**다. 막대는 높이 4px뿐이라 손가락으로는
            거의 잡히지 않아 "끌어도 안 닫힌다"로 느껴졌다(기기에서 확인). 보이는 모양은 그대로 두고
            판정 영역만 넓힌다 — 아래 도구 메뉴는 버튼이라 여기에 포함하지 않는다. */}
        <div
          aria-hidden="true"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          className="flex w-full shrink-0 touch-none justify-center py-2"
        >
          <div className="bg-cool-neutral-200 h-1 w-10 rounded-full" />
        </div>
        <ToolMenu activeTab={activeTab} onSelect={onSelectTab} isCompact={isKeyboardOpen} />
        <SheetBody activeTab={activeTab} content={content} isCompact={isKeyboardOpen} />
      </div>
    </>
  );
}

function PlaceNameField({ value, onChange, editable }: { value: string; onChange: (value: string) => void; editable: boolean }) {
  return (
    <div className="flex w-full flex-col gap-2 px-5">
      <p className="text-label-md text-cool-neutral-950 font-bold">다녀온 장소</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={!editable}
        placeholder={editable ? '다녀온 장소를 입력해주세요' : ''}
        className={`border-cool-neutral-300 text-body-md w-full rounded-2xl border px-4 py-3.5 outline-none ${
          editable ? 'text-warm-neutral-900 placeholder:text-cool-neutral-400' : 'bg-cool-neutral-50 text-warm-neutral-600'
        }`}
      />
    </div>
  );
}

function VisitedAtField({ value, onOpen }: { value: string; onOpen: () => void }) {
  return (
    <div className="flex w-full flex-col gap-2 px-5">
      <p className="text-label-md text-cool-neutral-950 font-bold">방문한 날짜</p>
      <button type="button" onClick={onOpen} className="border-cool-neutral-300 text-body-md text-warm-neutral-900 relative flex w-full items-center rounded-2xl border bg-white px-4 py-3.5 text-left">
        {formatVisitedAtDots(value)}
        <span className="text-cool-neutral-400 pointer-events-none absolute right-4">
          <IconCalendar />
        </span>
      </button>
    </div>
  );
}

type DateViewState = { year: number; month: number };

function DateCalendarSheet({
  isOpen,
  view,
  selected,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
  onClose,
}: {
  isOpen: boolean;
  view: DateViewState;
  selected: { year: number; month: number; day: number };
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (day: number) => void;
  onClose: () => void;
}) {
  const cells = getCalendarCells(view.year, view.month);
  const today = new Date();

  return (
    <>
      {isOpen && <div className="fixed inset-x-0 bottom-0 z-10" style={{ top: HEADER_HEIGHT }} onClick={onClose} />}
      <div
        className="bg-cool-neutral-white fixed inset-x-0 bottom-0 z-10 flex w-full flex-col items-center gap-5 rounded-t-4xl pt-2.5 shadow-[0_-6px_34px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-out"
        style={{ transform: isOpen ? 'translateY(0px)' : 'translateY(100%)', paddingBottom: `max(24px, var(--safe-area-bottom))` }}
      >
        <div aria-hidden="true" className="bg-cool-neutral-200 h-1 w-10 shrink-0 rounded-full" />

        <div className="flex w-full items-center justify-between px-6">
          <button type="button" aria-label="이전 달" onClick={onPrevMonth} className="flex h-8 w-8 items-center justify-center">
            <IconChevronLeft />
          </button>
          <p className="text-label-lg text-cool-neutral-950 font-bold">
            {view.year}년 {view.month + 1}월
          </p>
          <button type="button" aria-label="다음 달" onClick={onNextMonth} className="flex h-8 w-8 items-center justify-center">
            <span className="inline-block rotate-180">
              <IconChevronLeft />
            </span>
          </button>
        </div>

        <div className="grid w-full grid-cols-7 gap-y-2 px-6">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className="text-label-sm text-cool-neutral-400 text-center font-medium">
              {label}
            </span>
          ))}
          {cells.map((day, index) => {
            if (day == null) return <div key={`empty-${index}`} />;
            const isSelected = selected.year === view.year && selected.month === view.month && selected.day === day;
            const isToday = today.getFullYear() === view.year && today.getMonth() === view.month && today.getDate() === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => onSelectDay(day)}
                className={`text-body-md mx-auto flex h-10 w-10 items-center justify-center rounded-full ${
                  isSelected ? 'bg-tertiary-600 text-cool-neutral-white font-bold' : isToday ? 'text-tertiary-600 font-bold' : 'text-warm-neutral-900'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/**
 * 2단계 "저장완료"와 저장 후 "방명록 이동"이 화면 하단 같은 자리에 고정된다("다음"은 헤더에 있다).
 *
 * hasBackdrop은 바 뒤에 배경을 깐다. 이 바는 스크롤 영역 위에 떠 있어 배경이 없으면 카드가 버튼 뒤로
 * 비쳐 지나간다. 위쪽은 투명으로 흘려 페이지 배경(warm-neutral 그라데이션)과 경계가 생기지 않게 한다.
 *
 * **키보드가 떠도 숨기지 않는다.** 앱이 키보드 높이만큼 WebView를 줄이므로(app/app/guestbook.tsx) 이 바는
 * 키보드 위 새 바닥에 붙는데, 스크롤 영역이 그만큼(pb-28)을 이미 비워 두고 있어 입력칸은 이 바 위로
 * 스크롤된다. 숨겼다 되살리면 없던 버튼이 갑자기 생기는 것처럼 보인다.
 */
function FixedBottomBar({ children, hasBackdrop = false }: { children: ReactNode; hasBackdrop?: boolean }) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-10 px-5 ${hasBackdrop ? 'from-warm-neutral-100 via-warm-neutral-100 bg-linear-to-t to-transparent pt-8' : 'pt-3'}`}
      style={{ paddingBottom: `max(20px, var(--safe-area-bottom))` }}
    >
      {children}
    </div>
  );
}

function SaveButton({ label, disabled, onClick, hasBackdrop }: { label: string; disabled: boolean; onClick: () => void; hasBackdrop?: boolean }) {
  return (
    <FixedBottomBar hasBackdrop={hasBackdrop}>
      <button type="button" disabled={disabled} onClick={onClick} className="bg-cool-neutral-900 text-label-lg text-cool-neutral-white w-full rounded-full py-4 font-bold disabled:opacity-40">
        {label}
      </button>
    </FixedBottomBar>
  );
}

function CompleteScreen({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="from-tertiary-50 to-tertiary-100 flex min-h-dvh w-full flex-col items-center justify-center gap-6 bg-gradient-to-b px-5 pb-28">
      <div className="relative h-20 w-20">
        <Image src={travelNoteCompleteMark} alt="" aria-hidden="true" fill sizes="80px" className="object-contain" />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-heading-h4 text-warm-neutral-900 font-bold">방명록이 저장되었어요!</p>
        <p className="text-body-md text-warm-neutral-700">소중한 제주 여행의 추억이 기록되었습니다.</p>
      </div>
      <SaveButton label="방명록 이동" disabled={false} onClick={onNavigate} />
    </div>
  );
}

export function TravelNoteWritePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useMemo(() => parseGuestbookWriteParams(searchParams), [searchParams]);

  const [step, setStep] = useState<WriteStep>('content');
  /**
   * 1단계는 **시트가 떠 있는 상태가 기본**이다. 그 화면이 하는 일이 내용 채우기뿐이라,
   * 들어오자마자 카드를 한 번 눌러야 도구가 나오는 것은 한 단계를 헛도는 것이다.
   * 닫으면 카드가 화면 가운데로 내려오고, 다시 누르면 시트와 함께 위쪽 제자리로 돌아간다.
   */
  const [isSheetOpen, setIsSheetOpen] = useState(true);
  // 처음 열리는 도구는 **글**이다(TOOL_MENU의 첫 칸). 사진은 사진첩을 한 번 더 거쳐야 하지만
  // 글은 시트가 열리자마자 바로 쓸 수 있어, 아무것도 안 고른 상태에서 가장 덜 막힌다.
  const [activeTab, setActiveTab] = useState<ToolKey>('text');
  const [isSaved, setIsSaved] = useState(false);

  const [locationAlias, setLocationAlias] = useState(params.placeName ?? '');
  const [visitedAt, setVisitedAt] = useState(getTodayDateInputValue);
  const [isDateSheetOpen, setIsDateSheetOpen] = useState(false);
  const [dateView, setDateView] = useState<DateViewState>(() => {
    const { year, month } = parseDateInputValue(visitedAt);
    return { year, month };
  });
  const [contentWriting, setContentWriting] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [sounds, setSounds] = useState<SoundItem[]>([DEFAULT_MOCK_SOUND]);
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(null);
  const [contentTemperature, setContentTemperature] = useState(18);
  const [isTemperatureSheetOpen, setIsTemperatureSheetOpen] = useState(false);
  const [contentWeather, setContentWeather] = useState<string | null>(null);
  const [contentColorCode, setContentColorCode] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);

  function showToast(message: string) {
    setToast({ id: Date.now(), message });
  }

  // 선택한 사진의 blob URL은 페이지를 떠날 때 한 번에 해제한다(선택 도중 계속 만들어졌다 사라지는 URL이라 매 렌더마다 해제하면 안 된다).
  const createdPhotoUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      createdPhotoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // 사용자가 가져온 오디오 파일의 blob URL도 사진과 동일한 이유로 페이지를 떠날 때 한 번에 해제한다.
  const createdSoundUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      createdSoundUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function handleAddPhotos(files: File[]) {
    const newPhotos: PhotoItem[] = [];
    for (const file of files) {
      if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
        showToast('JPEG·PNG·WebP 사진만 추가할 수 있어요');
        continue;
      }
      if (file.size > MAX_PHOTO_FILE_SIZE_BYTES) {
        showToast('사진 한 장은 10MB를 넘을 수 없어요');
        continue;
      }
      const url = URL.createObjectURL(file);
      createdPhotoUrlsRef.current.push(url);
      newPhotos.push({ id: crypto.randomUUID(), url, file });
    }
    if (newPhotos.length === 0) return;
    setPhotos((prev) => [...prev, ...newPhotos]);
    setSelectedPhotoId(newPhotos[0].id);
  }

  function handleAddSounds(files: File[]) {
    const newSounds: SoundItem[] = [];
    for (const file of files) {
      if (!isAcceptedSoundFile(file)) {
        showToast('MP3·M4A·AAC·WAV·OGG·WebM 파일만 추가할 수 있어요');
        continue;
      }
      if (file.size > MAX_SOUND_FILE_SIZE_BYTES) {
        showToast('오디오 파일 하나는 10MB를 넘을 수 없어요');
        continue;
      }
      const url = URL.createObjectURL(file);
      createdSoundUrlsRef.current.push(url);
      newSounds.push({ id: crypto.randomUUID(), label: file.name, url, file });
    }
    if (newSounds.length === 0) return;
    setSounds((prev) => [...prev, ...newSounds]);
    setSelectedSoundId(newSounds[0].id);
  }

  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId) ?? null;
  const selectedPhotoUrl = selectedPhoto?.url ?? null;
  const selectedSound = sounds.find((sound) => sound.id === selectedSoundId) ?? null;

  function openDateSheet() {
    const { year, month } = parseDateInputValue(visitedAt);
    setDateView({ year, month });
    setIsDateSheetOpen(true);
  }

  function handleSelectDay(day: number) {
    setVisitedAt(formatDateInputValue(dateView.year, dateView.month, day));
    setIsDateSheetOpen(false);
  }

  function handlePrevMonth() {
    setDateView((prev) => (prev.month === 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: prev.month - 1 }));
  }

  function handleNextMonth() {
    setDateView((prev) => (prev.month === 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: prev.month + 1 }));
  }

  function handleSelectTemperature(value: number) {
    setContentTemperature(value);
    setIsTemperatureSheetOpen(false);
  }

  const isContentStep = step === 'content';
  const canGoNext = hasAnyGuestbookContent({ hasSelectedPhoto: selectedPhotoUrl !== null, contentWriting });

  /**
   * 2단계로 넘어가면서 **히스토리 항목을 하나 쌓는다**(주소는 그대로다).
   *
   * 기기 뒤로가기를 화면 닫기가 아니라 1단계로 돌리기 위해서다 — 앱은 WebView 히스토리에 갈 곳이
   * 있으면 그쪽을 먼저 따라간다(app/app/guestbook.tsx의 BackHandler). pushState는 문서를 갈아치우지
   * 않으므로 사진·소리의 blob URL은 그대로 살아 있다(파일 첫 주석의 이유가 여기서도 지켜진다).
   */
  function handleNext() {
    if (!canGoNext) return;
    // 시트를 연 채로 넘어가면 2단계 위에 그대로 떠 있게 된다.
    setIsSheetOpen(false);
    setIsTemperatureSheetOpen(false);
    window.history.pushState(null, '', window.location.href);
    setStep('place');
  }

  // 쌓아 둔 항목이 빠지면(기기 뒤로가기·브라우저 뒤로가기) 1단계로 돌아간다. 입력값은 그대로 남는다
  useEffect(() => {
    function handlePopState() {
      setStep('content');
      setIsSheetOpen(true);
      setIsDateSheetOpen(false);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 단계가 바뀌면 이전 단계에서 보던 스크롤 위치가 아니라 화면 위부터 보여준다.
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollAreaRef.current?.scrollTo({ top: 0 });
  }, [step]);

  // map 화면 "방명록 작성"(좌표만 전달)으로 들어온 경우 placeId가 없어 장소명을 직접 입력해야 저장 가능하다.
  const hasLocation = Boolean(params.placeId);
  const canSave = hasLocation || locationAlias.trim().length > 0;

  const { mutate: createGuestbook, isPending: isSaving, isError: hasSaveError } = useCreateGuestbook();

  function handleSave() {
    if (!canSave || isSaving) return;

    // 기본 제공 mock 오디오는 실제 파일이 없어(file: null) 전송 대상이 아니고, 사용자가 가져온 파일을 선택했을 때만 실어보낸다.
    const audioFiles = selectedSound?.file ? [selectedSound.file] : null;
    /**
     * **2단계 카드에 올라간 것만 보낸다.** 사진첩에서 여러 장을 가져와도 카드에 서는 건 고른 한 장이고,
     * 고른 것을 다시 눌러 빼면 카드에서 사라진다 — 목록에만 남은 사진까지 올리면 저장된 방명록이
     * 사용자가 보고 "저장완료"를 누른 그 화면과 달라진다. 소리를 다루는 방식과 같은 규칙이다.
     */
    const imageFiles = selectedPhoto ? [selectedPhoto.file] : null;
    // 기온도 마찬가지다 — 날씨를 고르지 않으면 카드에 기온 줄 자체가 없으므로 기본값 18°C를 보내지 않는다.
    const contentTemperatureCelsius = contentWeather != null ? contentTemperature : null;

    // POST /api/v1/guestbooks(GuestbookCreateRequest, multipart/form-data)에 맞춘 payload.
    // placeId/missionId는 지도 쪽(entities/place)에서 이미 서버 숫자 id를 문자열로 실어보낸 것이라 그대로 Number() 변환한다.
    const payload: GeneratedApi.GuestbookCreateRequest = hasLocation
      ? {
          guestbookType: GeneratedApi.GuestbookType.GENERAL,
          locationId: Number(params.placeId),
          visitedAt,
          contentWriting: contentWriting.trim() || null,
          contentWeather,
          contentTemperatureCelsius,
          contentColorCode,
          missionId: params.missionId ? Number(params.missionId) : null,
          imageFiles,
          audioFiles,
        }
      : {
          guestbookType: GeneratedApi.GuestbookType.ROAD,
          locationAlias: locationAlias.trim(),
          latitude: params.lat ?? null,
          longitude: params.lng ?? null,
          visitedAt,
          contentWriting: contentWriting.trim() || null,
          contentWeather,
          contentTemperatureCelsius,
          contentColorCode,
          imageFiles,
          audioFiles,
        };

    createGuestbook(payload, { onSuccess: () => setIsSaved(true) });
  }

  const sheetContent: SheetContentState = {
    contentWriting,
    onChangeContentWriting: setContentWriting,
    photos,
    selectedPhotoId,
    onSelectPhoto: (id) => setSelectedPhotoId((prev) => (prev === id ? null : id)),
    onAddPhotos: handleAddPhotos,
    sounds,
    selectedSoundId,
    onSelectSound: (id) => setSelectedSoundId((prev) => (prev === id ? null : id)),
    onAddSounds: handleAddSounds,
    contentTemperature,
    onChangeContentTemperature: setContentTemperature,
    onOpenTemperatureSheet: () => setIsTemperatureSheetOpen(true),
    contentWeather,
    onSelectContentWeather: (label) => setContentWeather((prev) => (prev === label ? null : label)),
    contentColorCode,
    onSelectContentColorCode: (hex) => setContentColorCode((prev) => (prev === hex ? null : hex)),
  };

  /**
   * 뒤로가기. MapDetailPage.tsx의 goBack과 같은 판단 로직이다.
   *
   * 미션 완료 화면(app/app/guestbook.tsx)은 이 경로를 새 WebView로 **첫 페이지째** 열어
   * 되돌아갈 웹 히스토리가 없다 — 그때만 앱에게 네이티브 스택 pop을 부탁한다(NAVIGATE_BACK).
   * 지도 장소상세/필터목록/방명록 작성버튼처럼 웹 히스토리가 있는 경로는 router.back()으로 되돌아간다.
   */
  const goBack = () => {
    // 2단계의 뒤로가기는 화면을 닫는 게 아니라 1단계로 돌아간다. 입력값은 같은 컴포넌트의 상태라
    // 그대로 남아 preset 되고, 다시 "다음"을 누르면 장소·날짜도 적어둔 채로 돌아온다.
    // 상태를 직접 바꾸지 않고 히스토리를 되감는다 — 쌓아 둔 항목이 남으면 기기 뒤로가기가 한 번 헛돈다.
    if (step === 'place') {
      window.history.back();
      return;
    }

    const target = resolveBackTarget({ canGoBack: readCanGoBack(), isInitialPath: isInitialPathname(), isWebView: isAppWebView() });

    if (target === 'app-stack') {
      sendToApp({ type: 'NAVIGATE_BACK', payload: {} });
      return;
    }
    // 브라우저로 URL을 직접 열면 돌아갈 곳이 없어 router.back()이 아무 일도 하지 않는다
    if (target === 'map-fallback') {
      router.push('/');
      return;
    }
    router.back();
  };

  if (isSaved) {
    return <CompleteScreen onNavigate={() => router.push('/travel-note')} />;
  }

  // 바텀시트가 열려 있는 동안 뒤의 메인 영역까지 같이 스크롤되는 걸 막는다(배경 스크롤 잠금).
  const isAnySheetOpen = isSheetOpen || isDateSheetOpen;

  /**
   * 1단계의 카드 자리는 **시트가 떠 있는지**에 따라 다르다. 닫혀 있으면 화면에 카드뿐이라 가운데에
   * 두고, 시트가 올라오면 가려지지 않게 위쪽(pt-8) 제자리로 보낸다. 2단계는 늘 가운데다.
   */
  const contentAreaClassName = !isContentStep ? `${CENTERED_SCROLL_AREA} pt-4 pb-28` : isAnySheetOpen ? 'overflow-hidden pt-8 pb-28' : `${CENTERED_SCROLL_AREA} py-4`;

  return (
    <div className="from-warm-neutral-50 to-warm-neutral-100 relative flex h-dvh w-full flex-col overflow-hidden bg-linear-to-b">
      <Header onBack={goBack} title={isContentStep ? mock.title : null} next={isContentStep ? { disabled: !canGoNext, onClick: handleNext } : null} />
      {/* 헤더를 스크롤에서 제외하려고 바깥 컨테이너를 h-dvh로 고정하고 이 영역만 스크롤시킨다(TravelEndingPage와 동일 패턴).
          pb-28은 하단 고정 CTA("저장완료")가 덮는 높이만큼 비워 두는 자리다 — CTA는 이 영역 위에 떠 있어
          스크롤이 생겨도 자리를 지킨다. */}
      <div ref={scrollAreaRef} className={`flex flex-1 flex-col gap-6 ${contentAreaClassName}`}>
        <PreviewCard
          onOpenSheet={isContentStep ? () => setIsSheetOpen(true) : null}
          contentWriting={contentWriting}
          selectedPhotoUrl={selectedPhotoUrl}
          selectedSound={selectedSound}
          contentWeather={contentWeather}
          contentTemperature={contentTemperature}
          contentColorCode={contentColorCode}
        />
        {!isContentStep && (
          <>
            <PlaceNameField value={locationAlias} onChange={setLocationAlias} editable={!hasLocation} />
            <VisitedAtField value={visitedAt} onOpen={openDateSheet} />
            {hasSaveError && <p className="text-body-sm text-tertiary-600 px-5 text-center">저장하지 못했어요. 다시 시도해주세요</p>}
          </>
        )}
      </div>
      {!isContentStep && <SaveButton label={isSaving ? '저장 중...' : '저장완료'} disabled={!canSave || isSaving} onClick={handleSave} hasBackdrop />}
      {isContentStep && (
        <>
          <BottomToolSheet isOpen={isSheetOpen} activeTab={activeTab} onSelectTab={setActiveTab} content={sheetContent} onClose={() => setIsSheetOpen(false)} />
          <TemperatureSheet isOpen={isTemperatureSheetOpen} temperature={contentTemperature} onSelect={handleSelectTemperature} onClose={() => setIsTemperatureSheetOpen(false)} />
        </>
      )}
      {!isContentStep && (
        <DateCalendarSheet
          isOpen={isDateSheetOpen}
          view={dateView}
          selected={parseDateInputValue(visitedAt)}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onSelectDay={handleSelectDay}
          onClose={() => setIsDateSheetOpen(false)}
        />
      )}
      {toast && <Toast key={toast.id} message={toast.message} onDone={() => setToast(null)} />}
    </div>
  );
}
