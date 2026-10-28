'use client';

import { useEffect, useState } from 'react';

/**
 * 소프트 키보드가 화면 하단을 가리는 높이(px)를 반환한다.
 * `position: fixed` 요소는 레이아웃 뷰포트 기준이라 키보드가 올라와도 자리를 지켜 키보드에 가려진다.
 * `visualViewport`는 키보드를 뺀 실제 보이는 영역을 알려주므로, 그 차이만큼 요소를 밀어올리면 된다.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    function handleViewportChange() {
      const offset = window.innerHeight - viewport!.height - viewport!.offsetTop;
      setInset(Math.max(0, Math.round(offset)));
    }

    viewport.addEventListener('resize', handleViewportChange);
    viewport.addEventListener('scroll', handleViewportChange);
    handleViewportChange();

    return () => {
      viewport.removeEventListener('resize', handleViewportChange);
      viewport.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  return inset;
}

/** 이만큼 줄어들면 키보드로 본다(px). 주소창 접힘 같은 잔변화와 가르는 값 */
const KEYBOARD_MIN_HEIGHT = 120;

/**
 * 소프트 키보드가 떠 있는지 여부.
 *
 * `useKeyboardInset`으로는 앱 안에서 알 수 없다. 앱은 키보드 높이만큼 **WebView 자체를** 줄이므로
 * (app/app/guestbook.tsx) web 입장에서는 창이 통째로 작아질 뿐 visualViewport와 레이아웃 뷰포트가
 * 여전히 같아 inset이 0으로 나온다. 그래서 **창 높이가 줄었는지**를 함께 본다.
 *
 * 입력칸 포커스를 신호로 쓰지 않는 이유: 안드로이드는 뒤로가기로 키보드만 내릴 수 있고 그때
 * blur가 오지 않는다 — 포커스는 남아 있는데 키보드는 없는 상태가 된다.
 */
export function useIsKeyboardOpen(): boolean {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // 이 화면에서 본 가장 큰 창 높이를 키보드가 없는 상태로 본다
    let maxHeight = window.innerHeight;

    function handleResize() {
      const height = window.innerHeight;
      if (height > maxHeight) maxHeight = height;
      setIsOpen(maxHeight - height > KEYBOARD_MIN_HEIGHT);
    }

    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  return isOpen;
}
