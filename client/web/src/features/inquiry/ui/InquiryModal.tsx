'use client';

import { useEffect, useState } from 'react';

const INQUIRY_MAX_LENGTH = 500;

/**
 * 문의하기 모달. UI만 구현된 상태 — 제출 시 서버로 보내는 API 연동은 아직 없다(제출하면 모달만 닫힘).
 *
 * 레이아웃·애니메이션은 `WithdrawConfirmModal`과 동일한 형태(취소/제출 버튼 쌍)를 따르되,
 * 문의 내용은 한 줄 입력이 아니라 여러 줄이 필요해 `TravelNoteWritePage`의 textarea 스타일을 쓴다.
 */
export function InquiryModal({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const canSubmit = content.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onClose();
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="문의하기"
        className={`bg-cool-neutral-white flex w-full max-w-90 flex-col gap-5 rounded-3xl px-6 py-7 transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-2">
          <h2 className="text-heading-h3 text-warm-neutral-900 font-bold">문의하기</h2>
          <p className="text-body-md text-warm-neutral-400">궁금한 점이나 불편한 점을 남겨주시면 확인 후 답변드릴게요.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="inquiry-content" className="text-label-md text-warm-neutral-800 font-semibold">
            문의 내용
          </label>
          <div className="border-cool-neutral-200 relative rounded-2xl border p-4">
            <textarea
              id="inquiry-content"
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, INQUIRY_MAX_LENGTH))}
              placeholder="문의 내용을 입력해주세요"
              rows={5}
              maxLength={INQUIRY_MAX_LENGTH}
              autoFocus
              className="text-body-md text-warm-neutral-900 placeholder:text-cool-neutral-400 w-full resize-none border-0 p-0 pb-5 outline-none"
            />
            <span className="text-label-sm text-cool-neutral-400 absolute right-4 bottom-3">
              {content.length}/{INQUIRY_MAX_LENGTH}
            </span>
          </div>
        </div>

        <div className="flex gap-2.5">
          <button type="button" onClick={onClose} className="border-cool-neutral-200 bg-cool-neutral-white text-label-lg text-warm-neutral-900 flex-1 rounded-full border py-3 font-medium">
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`text-label-lg text-cool-neutral-white flex-1 rounded-full py-3 font-bold transition-colors ${canSubmit ? 'bg-primary-900' : 'bg-cool-neutral-400'}`}
          >
            제출하기
          </button>
        </div>
      </div>
    </div>
  );
}
