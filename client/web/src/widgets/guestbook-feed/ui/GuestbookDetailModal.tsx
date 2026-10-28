'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useToggleGuestbookLike } from '@entities/guestbook';
import type { NormalizedGuestbook } from '../model/normalizeGuestbook';
import { formatRelativeTime } from '../model/relativeTime';
import AudioPlayerCard from '@/widgets/guestbook-feed/ui/AudioCard';

// NavMenuModal(widgets/nav-menu)과 동일한 fade-in 오버레이 패턴 — 배경 어둡게 + 중앙 팝업.
// 카드 크기는 유지한 채, 좌우로 다음/이전 방명록이 살짝 보이는 scroll-snap 캐러셀.
export function GuestbookDetailModal({ guestbooks, initialId, onClose }: { guestbooks: NormalizedGuestbook[]; initialId: string; onClose: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const selectedRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'auto' });
  }, []);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className={`fixed inset-0 z-50 bg-black/80 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`} onClick={onClose}>
      <div
        className="flex h-full snap-x snap-mandatory scrollbar-none items-center gap-6 overflow-x-auto px-10 py-6 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {guestbooks.map((guestbook) => (
          <div
            key={guestbook.key}
            ref={guestbook.key === initialId ? selectedRef : undefined}
            onClick={(e) => e.stopPropagation()}
            className={`bg-cool-neutral-white w-full max-w-90 shrink-0 snap-center overflow-y-auto rounded-2xl transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
            style={{ maxHeight: '85vh', scrollSnapAlign: 'center', backgroundColor: guestbook.contentColorCode ?? undefined }}
          >
            <GuestbookDetailCardContent guestbook={guestbook} />
          </div>
        ))}
      </div>
    </div>
  );
}

function GuestbookDetailCardContent({ guestbook }: { guestbook: NormalizedGuestbook }) {
  const { toggleLike } = useToggleGuestbookLike();
  // 클릭 즉시 반영할 낙관적 오버라이드. null이면 서버(guestbook.isLiked/likeCount)를 그대로 보여준다.
  const [optimisticLike, setOptimisticLike] = useState<{ isLiked: boolean; likeCount: number } | null>(null);
  const isLiked = optimisticLike?.isLiked ?? guestbook.isLiked ?? false;
  const likeCount = optimisticLike?.likeCount ?? guestbook.likeCount ?? 0;

  function handleToggleLike() {
    const previous = { isLiked, likeCount };
    const next = { isLiked: !isLiked, likeCount: Math.max(0, likeCount + (!isLiked ? 1 : -1)) };
    setOptimisticLike(next);
    toggleLike({ id: guestbook.id, guestbookType: guestbook.kind }, next.isLiked, { onError: () => setOptimisticLike(previous) });
  }

  const imageUrl = guestbook.contentImageUrls?.[0];
  const extraImageCount = (guestbook.contentImageUrls?.length ?? 0) - 1;
  // TEMP: 스토리지에 실제 mp3가 없어서 public/audios의 목업 파일로 대체
  const audioUrl = guestbook.contentAudioUrls?.[0] ? '/audios/mock-audio-01.mp3' : undefined;

  const metaSegments = [audioUrl || imageUrl ? null : `📍 ${guestbook.displayLocationName}`, formatRelativeTime(guestbook.savedAt), guestbook.contentWeather].filter(Boolean);

  return (
    <div className="flex flex-col gap-3 p-4">
      {audioUrl ? (
        <AudioPlayerCard audioUrl={audioUrl} placeName={guestbook.displayLocationName} title={'노래제목넣어'} />
      ) : imageUrl ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" className="aspect-square w-full rounded-2xl object-cover" />
          <span className="text-label-sm text-cool-neutral-white absolute right-3 bottom-3 flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 font-medium">
            📍 {guestbook.displayLocationName}
          </span>
          {extraImageCount > 0 ? <span className="text-label-sm text-cool-neutral-white absolute top-3 right-3 rounded-full bg-black/60 px-2 py-1 font-medium">+{extraImageCount}</span> : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        {/* TODO: 작성자 프로필/닉네임 — GET /api/v1/guestbooks 응답엔 없음(map 모달용 응답(userNickname)에만 존재). 백엔드에 이 엔드포인트에도 추가 요청 필요 */}
        <span className="bg-warm-neutral-200 h-11 w-11 shrink-0 rounded-full" aria-hidden="true" />
        <div className="flex min-w-0 flex-col">
          <span className="text-label-md text-warm-neutral-900 font-bold">익명</span>
          <span className="text-label-sm text-warm-neutral-400 truncate">{metaSegments.join(' · ')}</span>
        </div>
        <button
          type="button"
          onClick={handleToggleLike}
          aria-label="좋아요"
          aria-pressed={isLiked}
          className="border-cool-neutral-200 ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={isLiked ? '#FF6B6B' : 'none'} stroke={isLiked ? '#FF6B6B' : '#8a8a8a'} strokeWidth="2" strokeLinejoin="round">
            <path d="M12 21s-6.7-4.35-9.3-8.2C.6 9.7 1.4 6 4.6 4.7 7 3.7 9.4 4.6 12 7.3c2.6-2.7 5-3.6 7.4-2.6 3.2 1.3 4 5 1.9 8.1C18.7 16.65 12 21 12 21z" />
          </svg>
        </button>
      </div>

      {guestbook.contentWriting ? <p className="text-body-sm text-warm-neutral-700 whitespace-pre-wrap">{guestbook.contentWriting}</p> : null}
    </div>
  );
}
