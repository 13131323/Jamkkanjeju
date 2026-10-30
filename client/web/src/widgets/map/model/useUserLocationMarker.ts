'use client';

import { useEffect, useRef, useState } from 'react';
import { useCurrentAddress } from '@entities/location';
import type { Coordinates } from '@shared/config/geo';
import homeMyLocationIcon from '@shared/lib/images/home_my_location_icon.png';

const ANIMATION_DURATION_MS = 300;
const DEFAULT_LABEL = '내 위치';
const LOADING_LABEL = '주소 확인 중...';
const ERROR_LABEL = '주소를 찾을 수 없어요';

// 사용자 위치 마커(수동 지정 위치 포함)는 다른 어떤 마커에도 가려지지 않도록 z-index를 가장 높게 둔다 (17지도phase2추가수정.md)
const USER_LOCATION_MARKER_Z_INDEX = 20;

// home 화면 UserLocationMarker와 동일한 형태: 아이콘 원 위에, 라벨 pill이 아래에 겹쳐 붙는 구조.
// 탭(클릭)하면 "내 위치" 라벨이 현재 주소로 토글된다 — Android WebView 전용 앱이라 hover는 고려하지 않음.
function createUserLocationElement(onToggle: () => void): { el: HTMLElement; labelEl: HTMLSpanElement } {
  const el = document.createElement('div');
  // 마커 크기를 고정하고 라벨만 중앙 정렬해 주소 길이가 달라져도 아이콘 위치를 유지한다.
  el.className = 'js-pressable relative flex h-18 w-14 cursor-pointer flex-col items-center';
  el.addEventListener('click', onToggle);

  const badge = document.createElement('div');
  badge.className = 'bg-cool-neutral-white relative z-10 flex h-14 w-14 items-center justify-center rounded-full';
  const icon = document.createElement('img');
  icon.src = homeMyLocationIcon.src;
  icon.alt = '';
  icon.setAttribute('aria-hidden', 'true');
  icon.className = 'h-13.5 w-13.5 object-contain';
  badge.appendChild(icon);
  el.appendChild(badge);

  const label = document.createElement('span');
  label.className =
    'bg-cool-neutral-white text-warm-neutral-900 absolute top-13 left-1/2 flex h-5 w-max -translate-x-1/2 items-center justify-center rounded-full border border-warm-neutral-100 px-2.5 text-label-sm font-bold whitespace-nowrap shadow-[0_4px_4px_rgba(0,0,0,0.14)]';
  label.textContent = DEFAULT_LABEL;
  el.appendChild(label);

  return { el, labelEl: label };
}

// 오버레이 이동 보간 애니메이션. 실기기에서 성능 문제가 확인되면 이 함수를 걷어내고 setPosition 즉시 이동으로 대체 (06실시간마커최종.md §4)
function animateOverlayTo(overlay: kakao.maps.CustomOverlay, to: kakao.maps.LatLng, cancelRef: { current: number | null }) {
  if (cancelRef.current !== null) {
    cancelAnimationFrame(cancelRef.current);
  }

  const from = overlay.getPosition();
  const fromLat = from.getLat();
  const fromLng = from.getLng();
  const toLat = to.getLat();
  const toLng = to.getLng();
  const startTime = performance.now();

  function step(now: number) {
    const t = Math.min((now - startTime) / ANIMATION_DURATION_MS, 1);
    overlay.setPosition(new window.kakao.maps.LatLng(fromLat + (toLat - fromLat) * t, fromLng + (toLng - fromLng) * t));
    cancelRef.current = t < 1 ? requestAnimationFrame(step) : null;
  }

  cancelRef.current = requestAnimationFrame(step);
}

// coords가 바뀔 때마다 사용자 위치 마커를 생성/갱신하고, isFollowing이면 지도를 그 위치로 panTo한다.
// coords가 null이 되면(권한 거부/실패 등) 마커를 지도에서 제거한다.
// 마커를 탭하면 라벨이 "내 위치" ↔ 현재 주소로 토글된다(주소는 탭했을 때만 lazy하게 조회).
export function useUserLocationMarker(map: kakao.maps.Map | null, coords: Coordinates | null, isFollowing: boolean) {
  const overlayRef = useRef<kakao.maps.CustomOverlay | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [showAddress, setShowAddress] = useState(false);

  const { data: address, isFetching, isError } = useCurrentAddress(coords, showAddress);

  useEffect(() => {
    if (!map) return;

    if (!coords) {
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
      labelRef.current = null;
      return;
    }

    const position = new window.kakao.maps.LatLng(coords.lat, coords.lng);

    if (overlayRef.current) {
      animateOverlayTo(overlayRef.current, position, animationFrameRef);
    } else {
      const { el, labelEl } = createUserLocationElement(() => setShowAddress((prev) => !prev));
      labelRef.current = labelEl;

      const overlay = new window.kakao.maps.CustomOverlay({
        position,
        content: el,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: USER_LOCATION_MARKER_Z_INDEX,
      });
      overlay.setMap(map);
      overlayRef.current = overlay;
    }

    if (isFollowing) {
      map.panTo(position);
    }
  }, [map, coords, isFollowing]);

  // 라벨 텍스트는 위치 갱신 효과와 분리 — 토글 상태·주소 조회 결과가 바뀔 때만 갱신
  useEffect(() => {
    if (!labelRef.current) return;
    if (!showAddress) {
      labelRef.current.textContent = DEFAULT_LABEL;
    } else if (isFetching) {
      labelRef.current.textContent = LOADING_LABEL;
    } else if (isError) {
      labelRef.current.textContent = ERROR_LABEL;
    } else if (address) {
      labelRef.current.textContent = address;
    }
  }, [showAddress, address, isFetching, isError]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
    };
  }, []);
}
