'use client';

import { useCallback, useEffect, useState } from 'react';

// 사용자가 지도를 직접 드래그/줌 조작하면 follow off, "내 위치로 이동" 버튼 클릭 시에만 follow on 재개 (06실시간마커최종.md §4)
export function useMapFollow(map: kakao.maps.Map | null) {
  const [isFollowing, setIsFollowing] = useState(true);

  useEffect(() => {
    if (!map) return;

    const stopFollowing = () => setIsFollowing(false);

    window.kakao.maps.event.addListener(map, 'dragstart', stopFollowing);
    window.kakao.maps.event.addListener(map, 'zoom_changed', stopFollowing);

    return () => {
      window.kakao.maps.event.removeListener(map, 'dragstart', stopFollowing);
      window.kakao.maps.event.removeListener(map, 'zoom_changed', stopFollowing);
    };
  }, [map]);

  // 코드가 지도를 특정 좌표로 옮겼을 때(쿠폰 사용처 진입 등) 추적을 끊는 쪽.
  // setCenter는 dragstart/zoom_changed를 내지 않아 위 리스너로는 잡히지 않는다.
  // effect 의존성으로 쓰이므로 참조를 고정한다.
  const stopFollowing = useCallback(() => setIsFollowing(false), []);

  return { isFollowing, resumeFollowing: () => setIsFollowing(true), stopFollowing };
}
