'use client';

import { useEffect, useRef } from 'react';
import { useRoadGuestbooks } from '@entities/guestbook';
import type { Bounds } from '@shared/config/geo';
import { createContentPinElement } from './markerElements';
import { useGuestbookGroups } from './useGuestbookGroups';

// 방명록 마커는 로컬장소 마커보다 항상 아래에 가려지도록 z-index를 낮게 둔다 (17지도phase2추가수정.md)
const GUESTBOOK_MARKER_Z_INDEX = 1;

// 방명록 마커(zoom 1~5)는 로컬장소 개별 마커(ContentPinMarker 기본 크기)와 동일한 크기를 쓴다.
const GUESTBOOK_DETAIL_MARKER_SIZE = 36;

// bounds가 바뀔 때(=지도가 idle 상태가 될 때)마다 useRoadGuestbooks가 뷰포트 주변 고정 타일 9개를
// 조회한다(장소 마커와 같은 타일 캐시를 공유 — useRoadGuestbooks 주석 참고).
// level 1~5(detail 티어): 클러스터링 없이 개별 마커 그대로 표시 / level 6 이상(wideSplit/wide): 방명록 자체를
// 요청하지도, 마커도 그리지도 않는다.
export function useGuestbookMarkers(map: kakao.maps.Map | null, bounds: Bounds | null, level: number, onGuestbookClick: (guestbookId: number) => void) {
  const shouldFetch = map !== null && bounds !== null && level <= 5;

  const { guestbooks } = useRoadGuestbooks({ bounds, enabled: shouldFetch });

  const result = useGuestbookGroups(shouldFetch ? guestbooks : undefined, level);
  const overlaysRef = useRef<kakao.maps.CustomOverlay[]>([]);

  useEffect(() => {
    if (!map) return;

    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    const newOverlays: kakao.maps.CustomOverlay[] = [];

    if (result.mode === 'individual') {
      for (const guestbook of result.guestbooks) {
        const el = createContentPinElement(guestbook.representativeImageUrl ?? undefined, GUESTBOOK_DETAIL_MARKER_SIZE, true);
        el.addEventListener('click', () => onGuestbookClick(guestbook.id));

        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(guestbook.coords.lat, guestbook.coords.lng),
          content: el,
          xAnchor: 0.5,
          yAnchor: 1,
          zIndex: GUESTBOOK_MARKER_Z_INDEX,
        });
        overlay.setMap(map);
        newOverlays.push(overlay);
      }
    }

    overlaysRef.current = newOverlays;
  }, [map, result, onGuestbookClick]);

  useEffect(() => {
    return () => {
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
    };
  }, []);
}
