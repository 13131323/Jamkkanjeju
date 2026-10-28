'use client';

import { useEffect, useState } from 'react';

export type MapZoomTier = 'detail' | 'wideSplit' | 'wide';

// 사용자가 조작 가능한 줌 레벨은 1~9 전체를 허용한다(19지도phase3-map_search.md 이후 요청사항).
// 1~5: 개별 장소 마커(클러스터링 없음) / 6~7: 보물찾기·협동미션 위치기반 클러스터(wideSplit) / 8~9: 대분류 통합 원마커(wide)
//
// isClustered 요청 매핑: detail(1~5)만 isClustered=false(상세정보), wide/wideSplit(6~9)는 isClustered=true(좌표+미션유형만).
// wideSplit(6~7)도 화면엔 클러스터로 보이고 클러스터링에 각 장소의 미션 타입이 필요하지만, 그 값은
// 가벼운 클러스터 응답에도 이미 포함돼 있어(usePlaceGroups.ts 참고) 상세 응답을 받을 필요가 없다.
const MIN_LEVEL = 1;
const MAX_LEVEL = 9;

// 원마커/클러스터 마커를 눌렀을 때 한 단계 확대해서 진입할 목표 레벨.
// wide(8~9) 클릭 → wideSplit 진입점(7), wideSplit(6~7) 클릭 → detail 진입점(5).
//
// levelToTier와 같은 파일에 둔다 — 티어 경계를 정하는 곳이 진입 레벨도 함께 갖고 있어야
// 한쪽만 바뀌는 일이 없다. 지도 화면(usePlaceMarkers)과 보물찾기 마커(useTreasureMarkers)가
// 같은 상수를 본다.
export const WIDE_SPLIT_ENTRY_LEVEL = 7;
export const DETAIL_ENTRY_LEVEL = 5;

/**
 * 보물찾기 step1(`/map?mode=treasure`)로 들어올 때의 줌 레벨.
 *
 * 일반 지도의 진입 레벨(resolveDisplayLocation의 initialLevel)은 좌표가 있으면 5인데, 5도
 * detail 티어라 보물이 처음부터 **개별 마커**로 흩어져 보인다. step1은 "기본은 한 장소에 뭉친
 * 마커 하나(남은 개수 배지), 확대하면 좌표별 마커"가 요구사항이므로 클러스터 티어에서 열어야 한다.
 *
 * 7을 쓰는 이유: 클러스터 티어(6~9) 중 카카오 축척이 500m 근처여서 보물 반경
 * (TREASURE_ENTER_RADIUS_METERS 500m)만큼의 범위가 한눈에 들어온다. 값이 WIDE_SPLIT_ENTRY_LEVEL과
 * 같지만 의미가 달라(그쪽은 "wide 클러스터를 눌렀을 때 도착점") 상수를 따로 둔다.
 */
export const TREASURE_MODE_INITIAL_LEVEL = 7;

/** 줌 레벨 → 티어. 마커 형태를 정하는 유일한 경계라서, 테스트에서 레벨별로 확인할 수 있게 내보낸다 */
export function levelToTier(level: number): MapZoomTier {
  if (level <= 5) return 'detail';
  if (level <= 7) return 'wideSplit';
  return 'wide';
}

function clampLevel(level: number): number {
  if (level < MIN_LEVEL) return MIN_LEVEL;
  if (level > MAX_LEVEL) return MAX_LEVEL;
  return level;
}

export type MapZoomState = { tier: MapZoomTier; level: number };

export function useMapZoomTier(map: kakao.maps.Map | null): MapZoomState {
  const [state, setState] = useState<MapZoomState>({ tier: 'wide', level: 9 });

  useEffect(() => {
    if (!map) return;

    const initialLevel = clampLevel(map.getLevel());
    if (initialLevel !== map.getLevel()) map.setLevel(initialLevel);
    // 지도가 만들어진 뒤에야 level을 읽을 수 있어 useState 초기값으로 옮길 수 없다.
    // 'zoom_changed' 구독 전에 현재 값을 한 번 맞춰두는, 외부 시스템 동기화의 seed다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ tier: levelToTier(initialLevel), level: initialLevel });

    const handleZoomChanged = () => {
      const rawLevel = map.getLevel();
      const clamped = clampLevel(rawLevel);

      // setLevel 호출은 'zoom_changed'를 다시 유발하지만, clamped는 이미 범위 안이라
      // 재귀 호출된 핸들러는 조건이 거짓이 되어 한 번 더 실행된 뒤 종료된다 (무한루프 아님)
      if (clamped !== rawLevel) {
        map.setLevel(clamped);
      }

      setState({ tier: levelToTier(clamped), level: clamped });
    };

    window.kakao.maps.event.addListener(map, 'zoom_changed', handleZoomChanged);
    return () => {
      window.kakao.maps.event.removeListener(map, 'zoom_changed', handleZoomChanged);
    };
  }, [map]);

  return state;
}
