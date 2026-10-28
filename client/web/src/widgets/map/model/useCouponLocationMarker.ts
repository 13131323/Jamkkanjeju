'use client';

import { useEffect, useRef } from 'react';
import type { Coordinates } from '@shared/config/geo';
import { createContentPinElement } from './markerElements';
import { DETAIL_ENTRY_LEVEL } from './useMapZoomTier';

/** 사용자 위치 마커(20)보다 위 — "지금 가야 할 곳"이 다른 마커에 가리면 안 된다 */
const COUPON_MARKER_Z_INDEX = 30;

/**
 * 쿠폰 사용처 마커. 지도 화면의 개별 장소 마커(ContentPinMarker)와 같은 크기를 쓴다 —
 * 이 마커만의 디자인 값이 따로 없어서 새 크기를 만들지 않는다.
 */
const COUPON_MARKER_SIZE = 36;

type CouponMarkerHandlers = {
  /**
   * 지도를 사용처로 옮긴 뒤 호출된다. 사용자 위치 추적(useMapFollow)을 꺼서 다음 위치 갱신이
   * 지도를 도로 사용자 쪽으로 끌고 가지 않게 하는 용도다.
   */
  onFocus: () => void;
  /** 마커 탭. 내려둔 쿠폰 시트를 다시 올리는 유일한 경로다 */
  onPress: () => void;
};

/**
 * 앱의 "사용하러 가기"로 들어왔을 때 쿠폰 사용처를 지도에 표시하고 그 자리로 옮긴다.
 *
 * 좌표를 어떻게 구하는지는 useCouponLocationCoords가 맡는다 — 여기서는 좌표가 생기면 그리기만 한다.
 * 마커를 다시 만들지 않고 위치만 갱신하는 이유는, 좌표 출처가 서버 → 지오코딩으로 바뀌어도
 * 마커가 깜빡이지 않게 하기 위해서다.
 */
export function useCouponLocationMarker(map: kakao.maps.Map | null, coords: Coordinates | null, imageUrl: string | null, handlers: CouponMarkerHandlers) {
  const overlayRef = useRef<kakao.maps.CustomOverlay | null>(null);
  /** 이미 지도를 옮겼는지. 한 번만 옮긴다 — 그 뒤 사용자가 팬한 것을 덮지 않는다 */
  const hasFocusedRef = useRef(false);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!map || !coords) return;

    const position = new window.kakao.maps.LatLng(coords.lat, coords.lng);

    if (overlayRef.current) {
      overlayRef.current.setPosition(position);
    } else {
      // 사용처 대표 이미지는 TourAPI 결과라 없거나 실패할 수 있다. createContentPinElement가
      // 실패한 <img>를 숨겨 깨진 이미지 아이콘 대신 빈 원이 남는다.
      const el = createContentPinElement(imageUrl ?? undefined, COUPON_MARKER_SIZE, true);
      // 리스너는 마커를 만들 때 한 번만 붙이므로 최신 콜백을 ref에서 읽는다.
      el.addEventListener('click', () => handlersRef.current.onPress());

      const overlay = new window.kakao.maps.CustomOverlay({
        position,
        content: el,
        xAnchor: 0.5,
        // 지도 화면의 개별 장소 마커와 같은 정렬 — 핀 아래 끝이 좌표에 붙는다
        yAnchor: 1,
        zIndex: COUPON_MARKER_Z_INDEX,
      });
      overlay.setMap(map);
      overlayRef.current = overlay;
    }

    if (!hasFocusedRef.current) {
      hasFocusedRef.current = true;
      map.setCenter(position);
      // 가게 하나를 찾아가는 화면이라 개별 마커가 보이는 티어(detail)에서 열어야 한다.
      map.setLevel(DETAIL_ENTRY_LEVEL);
      handlersRef.current.onFocus();
    }
  }, [map, coords, imageUrl]);

  useEffect(() => {
    return () => {
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
    };
  }, []);
}
