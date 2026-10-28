'use client';

import { useEffect, useRef } from 'react';

/**
 * 지도 위 시트를 **지도 제스처로** 닫는다.
 *
 * 원래는 시트마다 `absolute inset-0`짜리 투명 레이어를 깔아 바깥 탭을 받았는데, 그 레이어가
 * 지도를 통째로 덮어 **시트가 떠 있는 동안 지도를 끌 수 없었다**(사용자 지적). 지도를 보면서
 * 주변을 둘러보는 것이 이 화면의 본래 동작이라, 레이어를 걷고 카카오 지도 이벤트로 옮긴다.
 *
 * 닫는 제스처는 **탭 하나뿐이다.** 끌기(dragstart)로도 닫아 봤더니 "시트를 띄워 둔 채 주변을
 * 둘러보는" 동작이 불가능했다 — 지도를 조금만 밀어도 시트가 사라진다(사용자 지적). 카카오 지도는
 * 끌기와 탭을 구분해 끌고 난 뒤에는 `click`을 쏘지 않으므로, 탭만 들으면 둘이 자연스럽게 갈린다.
 * 마커 탭은 마커 오버레이가 먼저 삼켜 여기로 오지 않는다.
 *
 * 닫기 콜백은 매 렌더 새로 오므로 ref로 읽는다 — 리스너를 다시 달면 그 사이 제스처를 놓친다.
 */
export function useDismissOnMapGesture(map: kakao.maps.Map | null, isOpen: boolean, onDismiss: () => void): void {
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!map || !isOpen) return;

    const dismiss = () => onDismissRef.current();
    kakao.maps.event.addListener(map, 'click', dismiss);

    return () => {
      kakao.maps.event.removeListener(map, 'click', dismiss);
    };
  }, [map, isOpen]);
}
