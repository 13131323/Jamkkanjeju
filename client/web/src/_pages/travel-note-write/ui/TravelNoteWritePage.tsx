'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent as ReactChangeEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseGuestbookWriteParams, useCreateGuestbook } from '@entities/guestbook';
import { GeneratedApi } from '@packages/shared';
import travelNoteCompleteMark from '@shared/lib/images/travel-note-complete-mark.png';

type ToolKey = 'text' | 'photo' | 'sound' | 'weather' | 'color';

const mock = {
  title: '방명록 남기기',
  nextLabel: '다음',
  photoPickerLabel: '사진 선택하기',
  contentPlaceholder: '후기를 작성해주세요.',
};

// 오늘 날짜를 <input type="date"> 값 포맷(YYYY-MM-DD)으로 반환 — 로컬 타임존 기준.
function getTodayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const TOOL_MENU: { key: ToolKey; label: string }[] = [
  { key: 'text', label: '글' },
  { key: 'photo', label: '사진' },
  { key: 'sound', label: '소리' },
  { key: 'weather', label: '날씨' },
  { key: 'color', label: '컬러' },
];

const WAVEFORM_BARS = [8, 14, 10, 16, 6, 12, 15, 9, 17, 11, 13, 7, 15, 10, 14, 8];

type MockSound = { id: number; date: string; url: string };

// TODO: 실제 소리 녹음/업로드 연동 전까지 담아둔 소리 mock 항목은 전부 같은 샘플 파일을 가리킨다.
const MOCK_SOUNDS: MockSound[] = [
  { id: 1, date: '2026.08.29', url: '/audios/mock-audio-01.mp3' },
  { id: 2, date: '2026.08.29', url: '/audios/mock-audio-01.mp3' },
];

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
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="8" r="1.25" fill="currentColor" />
      <path d="M2.5 13.5l4-4 3.5 3.5 2.5-2.5 4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 1.5v9l7-4.5-7-4.5z" fill="currentColor" className="text-cool-neutral-white" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="2" y="1.5" width="3" height="9" rx="1" fill="currentColor" className="text-cool-neutral-white" />
      <rect x="7" y="1.5" width="3" height="9" rx="1" fill="currentColor" className="text-cool-neutral-white" />
    </svg>
  );
}

function IconLocation() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 12.5s4.5-4.06 4.5-7.25a4.5 4.5 0 10-9 0C2.5 8.44 7 12.5 7 12.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="7" cy="5.25" r="1.6" stroke="currentColor" strokeWidth="1.4" />
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

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div
      className="relative flex w-full shrink-0 items-center justify-between px-4"
      style={{ height: `calc(56px + var(--safe-area-top))`, paddingTop: `var(--safe-area-top)` }}
    >
      <button type="button" aria-label="뒤로가기" onClick={onBack} className="flex items-center justify-center rounded-full p-1">
        <IconChevronLeft />
      </button>
      <span className="text-heading-h4 text-warm-neutral-900 absolute left-1/2 -translate-x-1/2 font-bold">{mock.title}</span>
      <button type="button" className="text-label-md bg-tertiary-600 text-cool-neutral-white rounded-full px-3 py-2 font-bold">
        {mock.nextLabel}
      </button>
    </div>
  );
}

function SoundPreviewChip({ sound }: { sound: MockSound }) {
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
      <button
        type="button"
        aria-label={isPlaying ? '일시정지' : '재생'}
        onClick={handleToggle}
        className="bg-cool-neutral-900 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
      >
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
  onOpenSheet: () => void;
  locationAlias: string;
  contentWriting: string;
  selectedPhotoUrl: string | null;
  selectedSound: MockSound | null;
  visitedAt: string;
  contentWeather: string | null;
  contentTemperature: number;
  contentColorCode: string | null;
};

function PreviewCard({ onOpenSheet, locationAlias, contentWriting, selectedPhotoUrl, selectedSound, visitedAt, contentWeather, contentTemperature, contentColorCode }: PreviewCardProps) {
  const weatherOption = contentWeather ? WEATHER_OPTIONS.find((option) => option.label === contentWeather) : null;

  return (
    <div className="w-full px-5">
      <div className="rounded-2xl bg-white p-2">
        <div
          onClick={onOpenSheet}
          className="bg-tertiary-100 flex min-h-70 w-full cursor-pointer flex-col gap-4 rounded-2xl p-3"
          style={contentColorCode ? { backgroundColor: contentColorCode } : undefined}
        >
          <div className="border-tertiary-100 relative flex aspect-square h-42.5 w-full items-center justify-center overflow-hidden rounded-xl border bg-[repeating-conic-gradient(#fafafa_0%_25%,#ebebeb_0%_50%)] bg-size-[30px_30px]">
            {selectedPhotoUrl ? (
              // 사용자가 방금 사진첩에서 고른 로컬 blob 이미지라 next/image 최적화 대상이 아니다.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedPhotoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2.5">
                <div className="bg-cool-neutral-900 flex h-14 w-14 items-center justify-center rounded-full">
                  <span className="text-cool-neutral-white">
                    <IconPhoto />
                  </span>
                </div>
                <span className="text-label-md text-cool-neutral-950 font-bold">{mock.photoPickerLabel}</span>
              </div>
            )}
          </div>
          {locationAlias && (
            <p className="text-label-md text-tertiary-600 flex items-center gap-1 font-bold">
              <IconLocation />
              {locationAlias}
            </p>
          )}
          <p className={contentWriting ? 'text-body-md text-warm-neutral-900' : 'text-body-md text-warm-neutral-500'}>{contentWriting || mock.contentPlaceholder}</p>
          {selectedSound && <SoundPreviewChip sound={selectedSound} />}
          <div className="flex items-end justify-between">
            <span className="text-label-sm text-warm-neutral-500">{formatVisitedAtDots(visitedAt)}</span>
            {weatherOption && (
              <span className="text-label-sm text-warm-neutral-500">
                {weatherOption.emoji} {contentTemperature}°C {weatherOption.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolMenu({ activeTab, onSelect }: { activeTab: ToolKey; onSelect: (tab: ToolKey) => void }) {
  return (
    <div className="flex w-full items-start justify-between px-6">
      {TOOL_MENU.map((item) => {
        const Icon = TOOL_ICONS[item.key];
        const isActive = item.key === activeTab;
        return (
          <button key={item.key} type="button" onClick={() => onSelect(item.key)} className="flex flex-col items-center gap-1.5">
            <span className={`flex h-14 w-14 items-center justify-center rounded-full ${isActive ? 'bg-cool-neutral-900 text-cool-neutral-white' : 'bg-cool-neutral-100 text-cool-neutral-400'}`}>
              <Icon />
            </span>
            <span className={`text-label-sm ${isActive ? 'text-cool-neutral-950 font-bold' : 'text-cool-neutral-400 font-medium'}`}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const CONTENT_WRITING_MAX_LENGTH = 50;

function TextTabContent({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex w-full flex-col gap-3 px-6">
      <p className="text-label-md text-cool-neutral-950 font-bold">글 남기기</p>
      <div className="border-cool-neutral-200 relative rounded-2xl border p-4">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, CONTENT_WRITING_MAX_LENGTH))}
          placeholder="여기에 후기를 작성할 수 있어요."
          rows={4}
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

function PhotoPicker({
  photos,
  selectedId,
  onSelect,
  onAddPhotos,
}: {
  photos: PhotoItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddPhotos: (files: File[]) => void;
}) {
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
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFilesChange} className="hidden" />
      {photos.length === 0 ? (
        <p className="text-label-md text-cool-neutral-400">아직 선택한 사진이 없어요</p>
      ) : (
        <div className="flex w-full items-center gap-3 overflow-x-auto">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              aria-label="사진 선택"
              onClick={() => onSelect(photo.id)}
              className={'relative h-24 w-24 shrink-0 overflow-hidden rounded-lg' + (photo.id === selectedId ? ' ring-cool-neutral-950 ring-2 ring-offset-2' : '')}
            >
              {/* 사용자가 방금 사진첩에서 고른 로컬 blob 이미지라 next/image 최적화 대상이 아니다. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
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
  sound: MockSound;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: () => void;
  onTogglePlay: (e: ReactMouseEvent) => void;
}) {
  const duration = useAudioDuration(sound.url);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label-sm text-cool-neutral-400">{sound.date}</span>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
        className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 ${isSelected ? 'border-tertiary-500 bg-tertiary-50' : 'border-cool-neutral-200'}`}
      >
        <button
          type="button"
          aria-label={isPlaying ? '일시정지' : '재생'}
          onClick={onTogglePlay}
          className="bg-cool-neutral-900 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        >
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

function SoundTabContent({ selectedId, onSelect }: { selectedId: number | null; onSelect: (id: number) => void }) {
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  function handleTogglePlay(e: ReactMouseEvent, sound: MockSound) {
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

  return (
    <div className="flex w-full flex-col gap-4 px-6">
      {/* 미리듣기 재생 전용 — 화면에는 노출하지 않는다 */}
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} className="hidden" />
      <p className="text-label-md text-cool-neutral-950 font-bold">담아둔 소리 선택하기</p>
      <div className="flex flex-col gap-4">
        {MOCK_SOUNDS.map((sound) => (
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
  selectedLabel,
  onSelect,
}: {
  temperature: number;
  onChangeTemperature: (temperature: number) => void;
  selectedLabel: string | null;
  onSelect: (label: string) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-4 px-6">
      <p className="text-label-md text-cool-neutral-950 font-bold">날씨 선택하기</p>
      <div className="bg-cool-neutral-50 flex items-center justify-between rounded-2xl px-4 py-4">
        <span className="text-heading-h3 text-cool-neutral-950 font-bold">{temperature}°C</span>
        <div className="text-cool-neutral-400 flex flex-col items-center gap-1">
          <button
            type="button"
            aria-label="온도 올리기"
            disabled={temperature >= TEMPERATURE_MAX}
            onClick={() => onChangeTemperature(Math.min(TEMPERATURE_MAX, temperature + 1))}
            className="flex h-3 w-6 items-center justify-center disabled:opacity-30"
          >
            <IconChevronUp />
          </button>
          <button
            type="button"
            aria-label="온도 내리기"
            disabled={temperature <= TEMPERATURE_MIN}
            onClick={() => onChangeTemperature(Math.max(TEMPERATURE_MIN, temperature - 1))}
            className="flex h-3 w-6 items-center justify-center disabled:opacity-30"
          >
            <IconChevronDown />
          </button>
        </div>
      </div>
      <div className="flex justify-between overflow-x-auto">
        {WEATHER_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onSelect(option.label)}
            className={`text-label-md flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3 py-2.5 font-medium ${
              option.label === selectedLabel ? 'border-tertiary-500 bg-tertiary-50 text-cool-neutral-950' : 'border-cool-neutral-200 text-cool-neutral-600'
            }`}
          >
            <span aria-hidden="true">{option.emoji}</span>
            {option.label}
          </button>
        ))}
      </div>
    </div>
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
  selectedSoundId: number | null;
  onSelectSound: (id: number) => void;
  contentTemperature: number;
  onChangeContentTemperature: (temperature: number) => void;
  contentWeather: string | null;
  onSelectContentWeather: (label: string) => void;
  contentColorCode: string | null;
  onSelectContentColorCode: (hex: string) => void;
};

function SheetBody({ activeTab, content }: { activeTab: ToolKey; content: SheetContentState }) {
  switch (activeTab) {
    case 'text':
      return <TextTabContent value={content.contentWriting} onChange={content.onChangeContentWriting} />;
    case 'photo':
      return <PhotoPicker photos={content.photos} selectedId={content.selectedPhotoId} onSelect={content.onSelectPhoto} onAddPhotos={content.onAddPhotos} />;
    case 'sound':
      return <SoundTabContent selectedId={content.selectedSoundId} onSelect={content.onSelectSound} />;
    case 'weather':
      return (
        <WeatherTabContent
          temperature={content.contentTemperature}
          onChangeTemperature={content.onChangeContentTemperature}
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
      {isOpen && <div className="fixed inset-0 z-10" onClick={onClose} />}
      <div
        className={`bg-cool-neutral-white fixed inset-x-0 bottom-0 z-10 flex h-84 w-full flex-col items-center gap-6 rounded-t-4xl pt-2.5 pb-6 shadow-[0_-6px_34px_rgba(0,0,0,0.1)] ${
          isDragging ? '' : 'transition-transform duration-300 ease-out'
        }`}
        style={{ transform: isOpen ? `translateY(${dragY}px)` : 'translateY(100%)' }}
      >
        <div
          aria-hidden="true"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          className="bg-cool-neutral-200 h-1 w-10 shrink-0 touch-none rounded-full"
        />
        <ToolMenu activeTab={activeTab} onSelect={onSelectTab} />
        <SheetBody activeTab={activeTab} content={content} />
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

function VisitedAtField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex w-full flex-col gap-2 px-5">
      <p className="text-label-md text-cool-neutral-950 font-bold">방문한 날짜</p>
      <div className="border-cool-neutral-300 relative flex items-center rounded-2xl border bg-white px-4 py-3.5">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-body-md text-warm-neutral-900 w-full bg-transparent outline-none [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
        />
        <span className="text-cool-neutral-400 pointer-events-none absolute right-4">
          <IconCalendar />
        </span>
      </div>
    </div>
  );
}

// "저장완료"/"방명록 이동" 두 상태 모두 화면 하단 같은 위치에 고정된다.
function SaveButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 px-5 pt-3" style={{ paddingBottom: `max(20px, var(--safe-area-bottom))` }}>
      <button type="button" disabled={disabled} onClick={onClick} className="bg-cool-neutral-900 text-label-lg text-cool-neutral-white w-full rounded-full py-4 font-bold disabled:opacity-40">
        {label}
      </button>
    </div>
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

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ToolKey>('photo');
  const [isSaved, setIsSaved] = useState(false);

  const [locationAlias, setLocationAlias] = useState(params.placeName ?? '');
  const [visitedAt, setVisitedAt] = useState(getTodayDateInputValue);
  const [contentWriting, setContentWriting] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedSoundId, setSelectedSoundId] = useState<number | null>(null);
  const [contentTemperature, setContentTemperature] = useState(18);
  const [contentWeather, setContentWeather] = useState<string | null>(null);
  const [contentColorCode, setContentColorCode] = useState<string | null>(null);

  // 선택한 사진의 blob URL은 페이지를 떠날 때 한 번에 해제한다(선택 도중 계속 만들어졌다 사라지는 URL이라 매 렌더마다 해제하면 안 된다).
  const createdPhotoUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      createdPhotoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function handleAddPhotos(files: File[]) {
    const newPhotos = files.map((file) => {
      const url = URL.createObjectURL(file);
      createdPhotoUrlsRef.current.push(url);
      return { id: crypto.randomUUID(), url, file };
    });
    setPhotos((prev) => [...prev, ...newPhotos]);
    setSelectedPhotoId(newPhotos[0].id);
  }

  const selectedPhotoUrl = photos.find((photo) => photo.id === selectedPhotoId)?.url ?? null;
  const selectedSound = MOCK_SOUNDS.find((sound) => sound.id === selectedSoundId) ?? null;

  // map 화면 "방명록 작성"(좌표만 전달)으로 들어온 경우 placeId가 없어 장소명을 직접 입력해야 저장 가능하다.
  const hasLocation = Boolean(params.placeId);
  const canSave = hasLocation || locationAlias.trim().length > 0;

  const { mutate: createGuestbook, isPending: isSaving, isError: hasSaveError } = useCreateGuestbook();

  function handleSave() {
    if (!canSave || isSaving) return;

    // POST /api/v1/guestbooks(GuestbookCreateRequest, multipart/form-data)에 맞춘 payload.
    // placeId/missionId는 지도 쪽(entities/place)에서 이미 서버 숫자 id를 문자열로 실어보낸 것이라 그대로 Number() 변환한다.
    const payload: GeneratedApi.GuestbookCreateRequest = hasLocation
      ? {
          guestbookType: GeneratedApi.GuestbookType.GENERAL,
          locationId: Number(params.placeId),
          visitedAt,
          contentWriting: contentWriting.trim() || null,
          contentWeather,
          contentTemperatureCelsius: contentTemperature,
          contentColorCode,
          missionId: params.missionId ? Number(params.missionId) : null,
          imageFiles: photos.map((photo) => photo.file),
          // TODO: 실제 소리 녹음/업로드 연동 전까지 항상 null(현재 소리 탭은 샘플 mp3를 가리키는 mock이라 실제 File이 없다)
          audioFiles: null,
        }
      : {
          guestbookType: GeneratedApi.GuestbookType.ROAD,
          locationAlias: locationAlias.trim(),
          latitude: params.lat ?? null,
          longitude: params.lng ?? null,
          visitedAt,
          contentWriting: contentWriting.trim() || null,
          contentWeather,
          contentTemperatureCelsius: contentTemperature,
          contentColorCode,
          imageFiles: photos.map((photo) => photo.file),
          audioFiles: null,
        };

    createGuestbook(payload, { onSuccess: () => setIsSaved(true) });
  }

  const sheetContent: SheetContentState = {
    contentWriting,
    onChangeContentWriting: setContentWriting,
    photos,
    selectedPhotoId,
    onSelectPhoto: setSelectedPhotoId,
    onAddPhotos: handleAddPhotos,
    selectedSoundId,
    onSelectSound: (id) => setSelectedSoundId((prev) => (prev === id ? null : id)),
    contentTemperature,
    onChangeContentTemperature: setContentTemperature,
    contentWeather,
    onSelectContentWeather: (label) => setContentWeather((prev) => (prev === label ? null : label)),
    contentColorCode,
    onSelectContentColorCode: (hex) => setContentColorCode((prev) => (prev === hex ? null : hex)),
  };

  if (isSaved) {
    return <CompleteScreen onNavigate={() => router.push('/travel-note')} />;
  }

  return (
    <div className="from-warm-neutral-50 to-warm-neutral-100 relative flex min-h-dvh w-full flex-col overflow-hidden bg-linear-to-b">
      <Header onBack={() => router.back()} />
      <div className="flex flex-1 flex-col gap-6 pt-8 pb-28">
        <PreviewCard
          onOpenSheet={() => setIsSheetOpen(true)}
          locationAlias={locationAlias}
          contentWriting={contentWriting}
          selectedPhotoUrl={selectedPhotoUrl}
          selectedSound={selectedSound}
          visitedAt={visitedAt}
          contentWeather={contentWeather}
          contentTemperature={contentTemperature}
          contentColorCode={contentColorCode}
        />
        <PlaceNameField value={locationAlias} onChange={setLocationAlias} editable={!hasLocation} />
        <VisitedAtField value={visitedAt} onChange={setVisitedAt} />
        {hasSaveError && <p className="text-body-sm text-tertiary-600 px-5 text-center">저장하지 못했어요. 다시 시도해주세요</p>}
      </div>
      <SaveButton label={isSaving ? '저장 중...' : '저장완료'} disabled={!canSave || isSaving} onClick={handleSave} />
      <BottomToolSheet isOpen={isSheetOpen} activeTab={activeTab} onSelectTab={setActiveTab} content={sheetContent} onClose={() => setIsSheetOpen(false)} />
    </div>
  );
}
