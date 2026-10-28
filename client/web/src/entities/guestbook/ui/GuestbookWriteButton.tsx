'use client';

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { isOutsideJeju, useCurrentCoords } from '@entities/location';
import { Toast } from '@shared/ui/Toast';
import { buildGuestbookWriteHref } from '../model/guestbookWriteHref';

// map 화면에서 쓰던 "방명록 작성" 버튼을 travel-note 화면과 공유하기 위해 뽑아낸 것.
// 길바닥 방명록은 좌표가 곧 위치라, 클릭 시점의 실제 현재 좌표로 제주 안인지 직접 확인한다.
export function GuestbookWriteButton({ className, style }: { className: string; style?: CSSProperties }) {
  const router = useRouter();
  const coords = useCurrentCoords();
  const [toastMessage, setToastMessage] = useState<{ id: number; text: string } | null>(null);

  function handleClick() {
    if (!coords) {
      setToastMessage({ id: Date.now(), text: '위치를 확인할 수 없어 방명록을 작성할 수 없어요' });
      return;
    }
    if (isOutsideJeju(coords)) {
      setToastMessage({ id: Date.now(), text: '제주 안에서만 방명록을 작성할 수 있어요' });
      return;
    }
    router.push(buildGuestbookWriteHref({ lat: coords.lat, lng: coords.lng }));
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`border-cool-neutral-200 bg-cool-neutral-white text-label-md text-warm-neutral-900 flex items-center gap-1.5 rounded-full border px-3.5 py-2.5 font-medium shadow-[0_6px_16px_-4px_rgba(0,0,0,0.1)] ${className}`}
        style={style}
      >
        <PencilIcon />
        <span>방명록 작성</span>
      </button>
      {toastMessage && <Toast key={toastMessage.id} message={toastMessage.text} onDone={() => setToastMessage(null)} />}
    </>
  );
}

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M12.7 2.7a1.5 1.5 0 0 1 2.1 2.1L6.5 13 3 14l1-3.5 8.7-7.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" className="text-warm-neutral-900" />
    </svg>
  );
}
