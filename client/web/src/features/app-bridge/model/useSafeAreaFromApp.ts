'use client';

import { useEffect } from 'react';
import { listenFromApp } from '@shared/lib/bridge/utils';

/**
 * 앱이 밀어주는 안전영역(SAFE_AREA_UPDATE)을 CSS 변수로 반영한다.
 *
 * Android WebView는 RN 뷰 계층 안의 자식이라 시스템 바의 존재를 모른다.
 * 그래서 `env(safe-area-inset-*)`가 항상 0이고, 네이티브가 실측값을 넘겨줘야 한다.
 *
 * 다만 bottom은 앱이 항상 0을 보낸다(app/src/styles/safeArea.ts의 WEBVIEW_BOTTOM_INSET).
 * 하단 inset은 앱 루트 레이아웃이 네이티브에서 먹이므로 web이 더 띄우면 이중 여백이 된다.
 * 실질적으로 이 훅이 옮기는 값은 top이다.
 * globals.css의 `:root`에 선언된 기본값(= env() 폴백)을 인라인 스타일로 덮는 방식이라
 * WebView 밖(브라우저 단독)에서는 이 훅이 아무것도 하지 않고 기본값이 그대로 쓰인다.
 *
 * 앱은 web 마운트(PING) / inset 변경 / 화면 재포커스마다 보낸다.
 * 같은 값이 중복으로 와도 같은 변수를 다시 쓰는 것뿐이라 무해하다.
 */
export function useSafeAreaFromApp(): void {
  useEffect(() => {
    return listenFromApp((message) => {
      if (message.type !== 'SAFE_AREA_UPDATE') return;
      const { top, bottom } = message.payload;
      const root = document.documentElement;
      // 소수 inset을 그대로 쓰면 서브픽셀 렌더링으로 1px 틈이 생긴다
      root.style.setProperty('--safe-area-top', `${Math.round(top)}px`);
      root.style.setProperty('--safe-area-bottom', `${Math.round(bottom)}px`);
    });
  }, []);
}
