import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { JUDGE_MODE_COORDS } from '@packages/shared';
import { useJudgeModeStore } from '@/store/judgeMode';

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * 현재 좌표를 한 번만 읽는다.
 *
 * useTreasureLocation은 1초 간격 watch + 나침반 구독이라 지도·카메라 화면용이다.
 * 완료 화면은 추천 목록을 거리순으로 받으려고 좌표가 한 번 필요할 뿐이라 구독까지 갈 이유가 없다.
 *
 * 마지막으로 알려진 위치를 먼저 본다 — GPS 측위는 실외에서도 몇 초가 걸려서, 그 사이 화면이
 * 빈 상태로 남는다. 캐시가 없을 때만 실제 측위를 기다린다.
 *
 * 권한은 호출부(미션 인트로)가 이미 요청했다고 본다. 거부 상태면 두 호출 모두 실패하므로
 * null을 유지하고, 그 판단(대체 문구·재요청)은 호출부에 맡긴다.
 *
 * 심사위원용 모드에서는 측위 자체를 건너뛰고 제주시청 좌표를 돌려준다. 이 훅을 쓰는 화면이
 * **미션 완료의 "근처 장소" 추천**(complete.tsx)과 협동 미션인데, 제주 밖에서 실제 좌표로
 * 물으면 근처에 아무것도 없어 목록이 비어 버린다.
 */
export function useCurrentCoordsOnce(enabled: boolean): LatLng | null {
  const isJudgeMode = useJudgeModeStore((state) => state.enabled);
  const [coords, setCoords] = useState<LatLng | null>(null);

  useEffect(() => {
    // 모드가 켜져 있으면 측위할 이유가 없다 — 아래에서 고정 좌표를 돌려준다
    if (!enabled || isJudgeMode || coords !== null) return;

    let isMounted = true;
    void (async () => {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (isMounted && last) {
          setCoords({ lat: last.coords.latitude, lng: last.coords.longitude });
          return;
        }

        // 캐시가 없을 때만 측위한다. Balanced면 이 화면에 충분하다 —
        // 거리순 추천은 수십 m 오차로 순서가 뒤집히지 않는다.
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (isMounted) setCoords({ lat: current.coords.latitude, lng: current.coords.longitude });
      } catch {
        // 권한 거부·측위 실패. null을 유지한다 — 호출부가 좌표 없는 상태를 처리한다
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [enabled, isJudgeMode, coords]);

  // 측위로 담아 둔 값보다 고정 좌표가 먼저다 — 모드를 켜기 전에 이미 실제 좌표를 잡아 뒀어도
  // 켠 뒤에는 제주로 보여야 한다(web의 resolveCurrentCoords와 같은 우선순위).
  return isJudgeMode ? JUDGE_MODE_COORDS : coords;
}
