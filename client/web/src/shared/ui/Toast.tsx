'use client';

import { useEffect, useState } from 'react';

/**
 * 짧게 떴다 사라지는 안내 말풍선.
 *
 * 생김새는 앱의 `dark` 토스트(app/src/components/Toast/styles.ts)를 그대로 옮겼다 —
 * 배경 rgba(42,38,33,0.92) / radius 14 / padding 12·16 / 흰 글자 14·20 medium / 최대 폭 328.
 *
 * 큐를 두지 않는다: 여기 쓰이는 곳은 심사위원용 모드 진입처럼 한 번만 뜨는 안내뿐이라 겹칠 상황이 없다.
 * 같은 문구를 다시 띄우려면 호출부가 `key`를 바꿔 다시 마운트한다.
 */

/** 문구가 화면에 머무는 시간(페이드 제외) */
const TOAST_VISIBLE_MS = 2400;

/** 페이드 인/아웃 길이. 아래 duration-200과 같은 값이어야 사라지기 전에 언마운트되지 않는다 */
const TOAST_FADE_MS = 200;

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 첫 프레임을 opacity-0으로 그린 뒤 켜야 전환이 실제로 재생된다(모달들과 같은 방식)
    const frame = requestAnimationFrame(() => setIsVisible(true));
    const fadeOutTimer = setTimeout(() => setIsVisible(false), TOAST_FADE_MS + TOAST_VISIBLE_MS);
    const doneTimer = setTimeout(onDone, TOAST_FADE_MS + TOAST_VISIBLE_MS + TOAST_FADE_MS);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(fadeOutTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  // pointer-events-none — 토스트가 떠 있는 동안에도 아래 화면을 계속 조작할 수 있어야 한다.
  // 하단 미션 배너(bottom 24 + 배너 높이 98)를 덮지 않도록 그 위로 띄운다.
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" style={{ bottom: `calc(138px + var(--safe-area-bottom))` }}>
      <div
        className={`text-label-md text-cool-neutral-white max-w-82 rounded-lg px-4 py-3 text-center font-medium transition-opacity duration-200 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        style={{ backgroundColor: 'rgba(42, 38, 33, 0.92)' }}
        role="status"
      >
        {message}
      </div>
    </div>
  );
}
