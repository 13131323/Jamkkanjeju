'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';

/** 기존 중앙 확인 모달의 디자인과 동작을 공유한다. */
export function ConfirmModal({
  title,
  cancelLabel = '취소',
  confirmLabel = '확인',
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  cancelLabel?: string;
  confirmLabel?: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const titleId = useId();
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pending, onCancel]);

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={(event) => {
        event.stopPropagation();
        if (!pending) onCancel();
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={pending}
        className={`bg-cool-neutral-white flex w-full max-w-90 flex-col gap-5 rounded-3xl px-6 py-7 transition-all duration-300 ${visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-heading-h3 text-warm-neutral-900 font-bold">
          {title}
        </h2>
        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={pending}
            autoFocus
            onClick={onCancel}
            className="border-cool-neutral-200 bg-cool-neutral-white text-label-lg text-warm-neutral-900 flex-1 rounded-full border py-3 font-medium disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button type="button" disabled={pending} onClick={onConfirm} className="bg-tertiary-800 text-label-lg text-cool-neutral-white flex-1 rounded-full py-3 font-medium disabled:opacity-50">
            {pending ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
