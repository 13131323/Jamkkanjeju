'use client';

import { useEffect, useRef, useState } from 'react';

interface AudioPlayerCardProps {
  audioUrl: string;
  title: string | null;
  placeName: string | null;
}

// 디자인에 보이는 막대(bar) 개수와 각 막대의 상대적 높이(%)입니다.
// 실제 오디오 파형을 분석한 값이 아니라, 디자이너가 준 시안을 그대로
// 재현하기 위한 고정 패턴입니다. 필요하면 이 배열만 바꿔서 모양을
// 자유롭게 조정할 수 있습니다.
const BAR_HEIGHTS = [45, 65, 100, 70, 100, 60, 45, 55, 40, 50, 35, 60, 45, 30];

function formatTime(seconds: number) {
  if (!isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={28} height={28} className={className} aria-hidden="true">
      <path d="M7.76 5.44 L18.24 11.06 Q20 12 18.24 12.94 L7.76 18.56 Q6 19.5 6 17.5 L6 6.5 Q6 4.5 7.76 5.44 Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={28} height={28} className={className} aria-hidden="true">
      <rect x="5" y="4" width="5" height="16" rx="1.5" fill="currentColor" />
      <rect x="14" y="4" width="5" height="16" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export default function AudioPlayerCard({ audioUrl, title, placeName }: AudioPlayerCardProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  // 막대를 클릭/드래그해서 특정 지점으로 seek 하기
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * duration;
  };

  const progress = duration ? currentTime / duration : 0;
  const progressBarIndex = Math.floor(progress * BAR_HEIGHTS.length);

  return (
    <div className="w-full max-w-md rounded-lg bg-[#2b2621] p-4 text-white">
      {/* 숨겨진 실제 오디오 엘리먼트 */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* 장소명 배지 */}
      <div className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3.5 py-1">
        📍
        <span className="text-sm text-white">{placeName}</span>
      </div>

      {/* 막대(bar) 진행률 표시 */}
      <div className="js-pressable mb-2 flex h-12 cursor-pointer items-end gap-1.5" onClick={handleSeek}>
        {BAR_HEIGHTS.map((height, i) => (
          <div key={i} className={`flex-1 rounded-md transition-colors ${i <= progressBarIndex ? 'bg-[#7ec242]' : 'bg-[#5c5650]'}`} style={{ height: `${height}%` }} />
        ))}
      </div>

      {/* 시간 표시 */}
      <div className="mb-2 flex justify-between text-sm text-white/50">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* 재생 버튼 + 제목 */}
      <div className="flex items-center gap-4">
        <button onClick={togglePlay} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white" aria-label={isPlaying ? '일시정지' : '재생'}>
          {isPlaying ? <PauseIcon className="text-[#7ec242]" /> : <PlayIcon className="ml-1 text-[#7ec242]" />}
        </button>
        <p className="text-xl font-semibold">{title}</p>
      </div>
    </div>
  );
}
