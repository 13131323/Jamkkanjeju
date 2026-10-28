'use client';

import { useEffect } from 'react';

// 클릭 피드백 대상과 globals.css의 opacity 규칙 셀렉터를 그대로 공유한다.
const PRESSABLE_SELECTOR = "button:not(:disabled), a, [role='button'], .js-pressable";
const PRESSED_CLASS = 'is-pressed';
// 스크롤/스와이프 중 손가락이 버튼 위를 지나가며 눌린 채로 "끼는" 것을 막기 위한 이동 취소 임계값(px)
const MOVE_CANCEL_THRESHOLD_PX = 10;

/**
 * CSS `:active`는 RN WebView(Android)에서 실제 터치로는 신뢰성 있게 걸리지 않는다
 * (임베드 WebView에서 흔한 문제 — iOS Safari의 유명한 :active 미동작 이슈와 같은 종류).
 * 그래서 touchstart/touchend로 직접 `.is-pressed` 클래스를 토글해 같은 시각 효과를 보장한다.
 * 일반 브라우저의 `:active`는 그대로 살아있어 둘 다 동작한다(globals.css 참고).
 */
export function usePressFeedback() {
  useEffect(() => {
    let pressedEl: HTMLElement | null = null;
    let startX = 0;
    let startY = 0;

    function clearPressed() {
      pressedEl?.classList.remove(PRESSED_CLASS);
      pressedEl = null;
    }

    function onTouchStart(e: TouchEvent) {
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>(PRESSABLE_SELECTOR) : null;
      if (!target) return;
      pressedEl = target;
      pressedEl.classList.add(PRESSED_CLASS);
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (!pressedEl) return;
      const touch = e.touches[0];
      if (Math.abs(touch.clientX - startX) > MOVE_CANCEL_THRESHOLD_PX || Math.abs(touch.clientY - startY) > MOVE_CANCEL_THRESHOLD_PX) {
        clearPressed();
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', clearPressed, { passive: true });
    document.addEventListener('touchcancel', clearPressed, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', clearPressed);
      document.removeEventListener('touchcancel', clearPressed);
    };
  }, []);
}
