'use client';

import { useEffect, useId, useRef } from 'react';

/** 홈과 공통 503 안내에서 같은 디자인·닫힘 방지·포커스 처리를 사용한다. */
export function MaintenanceDialog({ message = '현재 서비스 점검 중입니다.', period, actionLabel, onAction }: {
  message?: string;
  period?: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const titleId = useId();
  const messageId = useId();
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    button.current?.focus();
    const keepFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        button.current?.focus();
      }
    };
    document.addEventListener('keydown', keepFocus, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keepFocus, true);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-[10000] flex touch-none items-center justify-center bg-black/50 px-6 backdrop-blur-md">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} className="bg-cool-neutral-white flex max-h-[80dvh] w-full max-w-90 touch-pan-y flex-col items-center gap-5 overflow-y-auto rounded-3xl px-6 py-8 text-center shadow-xl outline-none">
        <div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-tertiary-100 text-tertiary-800">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </svg>
        </div>
        <h1 id={titleId} className="text-heading-h3 text-warm-neutral-900 font-bold">서비스 점검 중입니다</h1>
        <p id={messageId} className="text-body-md text-warm-neutral-700 w-full whitespace-pre-wrap break-words">{message}</p>
        {period && <div className="bg-cool-neutral-100 w-full rounded-2xl px-3 py-4">
          <p className="text-label-sm text-cool-neutral-600 mb-1">점검 시간 (한국시간)</p>
          <p className="text-label-md text-warm-neutral-900 font-semibold">{period}</p>
        </div>}
        <p className="text-body-sm text-cool-neutral-500">점검이 끝난 후 다시 이용해 주세요.</p>
        <button ref={button} type="button" onClick={onAction} className="bg-cool-neutral-900 text-cool-neutral-white text-label-md w-full rounded-full px-6 py-3 font-bold">{actionLabel}</button>
      </div>
    </div>
  );
}
