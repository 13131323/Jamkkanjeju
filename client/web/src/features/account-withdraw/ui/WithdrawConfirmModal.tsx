'use client';

import { useEffect, useState } from 'react';
import { sendToApp } from '@shared/lib/bridge/utils';
import { isWithdrawPhraseComplete, WITHDRAW_CONFIRM_PHRASE } from '../model/withdrawPhrase';

/**
 * 회원탈퇴 확인 모달.
 *
 * 서버에 지울 개인정보가 없어 API를 호출하지 않는다 — "탈퇴"는 이 기기에 남은 로컬 데이터를
 * 지우는 것으로 구현된다(ACCOUNT_DELETE_REQUEST). 앱이 세션·로컬 저장소를 지우고 첫 화면
 * (온보딩)으로 보내므로, 여기서 성공 화면을 따로 그리지 않는다 — 확정 버튼을 누르면 이
 * 화면(마이페이지) 자체가 곧 사라진다.
 *
 * 실수로 되돌릴 수 없는 액션이라 확인 문구를 정확히 입력해야만 버튼이 활성화된다
 * (JudgeCodeModal과 같은 형태의 확인 모달이지만, 이건 코드가 아니라 문구 대조다).
 */
export function WithdrawConfirmModal({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const canSubmit = isWithdrawPhraseComplete(input);

  function handleSubmit() {
    if (!canSubmit) return;
    // 앱이 로컬 데이터를 지우고 곧바로 종료한다 — 응답을 기다릴 필요가 없다.
    sendToApp({ type: 'ACCOUNT_DELETE_REQUEST', payload: {} });
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="회원탈퇴 확인"
        className={`bg-cool-neutral-white flex w-full max-w-90 flex-col gap-5 rounded-3xl px-6 py-7 transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-2">
          <h2 className="text-heading-h3 text-warm-neutral-900 font-bold">회원탈퇴</h2>
          <p className="text-body-md text-warm-neutral-400">
            탈퇴하면 이 기기에 저장된 온보딩 정보·진행 중인 미션·걸음 수 기록이 모두 사라지고, 처음 화면(온보딩)으로 돌아가요. 이후엔 새 계정으로 다시 시작해요.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="withdraw-confirm-input" className="text-label-md text-warm-neutral-800 font-semibold">
            계속하려면 &quot;{WITHDRAW_CONFIRM_PHRASE}&quot;를 입력해주세요
          </label>
          <input
            id="withdraw-confirm-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) handleSubmit();
            }}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            placeholder={WITHDRAW_CONFIRM_PHRASE}
            className="border-cool-neutral-300 text-body-md text-cool-neutral-900 placeholder:text-cool-neutral-400 w-full rounded-md border bg-transparent px-3.5 py-2.5 outline-none"
          />
        </div>

        <div className="flex gap-2.5">
          <button type="button" onClick={onClose} className="border-cool-neutral-200 bg-cool-neutral-white text-label-lg text-warm-neutral-900 flex-1 rounded-full border py-3 font-medium">
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`text-label-lg text-cool-neutral-white flex-1 rounded-full py-3 font-bold transition-colors ${canSubmit ? 'bg-[#ff3030]' : 'bg-cool-neutral-400'}`}
          >
            탈퇴하기
          </button>
        </div>
      </div>
    </div>
  );
}
