import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { applyAdminPosition } from '@/store/adminLocation';
import { isValidHeading, normalizeAngleDelta, smoothHeading, type Coords } from '@/utils/geo';

/**
 * expo-location이 trueHeading을 아직 못 구했을 때 돌려주는 값. isValidHeading()이 걸러낸다.
 * 브릿지에도 같은 값(TREASURE_INVALID_HEADING)이 있지만 그쪽은 app↔web 전송 규약이라
 * 의미가 다르다 — 여기서는 센서 상태를 나타내는 값이므로 별도로 둔다.
 */
export const INVALID_HEADING = -1;

/**
 * 이만큼 움직이지 않은 heading 변화는 버린다(도).
 *
 * step2의 아이콘 가로 위치는 heading에 비례한다(computeScreenX) — FOV 65도가 화면 폭 360px에
 * 대응하므로 0.2도는 약 1px이다. 그보다 작은 흔들림은 화면에 나타나지 않으면서 리렌더만 만든다.
 */
const HEADING_UPDATE_THRESHOLD_DEGREES = 0.2;

export interface TreasureLocation {
  coords: Coords | null;
  /** 스무딩된 trueHeading. 아직 유효하지 않으면 INVALID_HEADING */
  heading: number;
  /** 위치 권한이 거부됐다. step2는 이 값으로 대체 화면을 띄운다 */
  permissionDenied: boolean;
}

/** 실시간 센서 좌표와 나침반을 구독한다. 관리자 좌표 변환은 센서 입력에 한 번 적용한다. */
export function useTreasureLocation(): TreasureLocation {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [heading, setHeading] = useState<number>(INVALID_HEADING);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let positionSubscription: Location.LocationSubscription | null = null;
    let headingSubscription: Location.LocationSubscription | null = null;

    async function subscribe() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!isMounted) return;
      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }

      positionSubscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0 }, (location) => {
        setCoords(applyAdminPosition({ latitude: location.coords.latitude, longitude: location.coords.longitude }));
      });

      headingSubscription = await Location.watchHeadingAsync((next) => {
        setHeading((previous) => {
          // trueHeading은 보정이 흔들리는 동안 잠깐씩 무효값(-1)으로 온다. 그때마다 INVALID로
          // 되돌리면 step2가 배치를 통째로 버려서 보물이 깜빡인다 — 직전 유효값을 그대로 지킨다.
          // 첫 유효값을 받기 전에는 여전히 INVALID_HEADING이라 "나침반을 못 읽었어요" 안내는 그대로 뜬다.
          if (!isValidHeading(next.trueHeading)) return previous;

          // 첫 유효값은 스무딩하지 않는다 — 직전 값이 INVALID(-1)라 섞으면 엉뚱한 각도에서 출발한다
          if (!isValidHeading(previous)) return next.trueHeading;

          const smoothed = smoothHeading(previous, next.trueHeading);
          // 같은 값을 돌려주면 React가 리렌더를 건너뛴다. 나침반은 가만히 있어도 초당 수십 번
          // 소수점만 다른 값을 밀어 넣는데, 그 차이는 step2 화면에서 1px도 움직이지 않으면서
          // 화면 전체를 그 빈도로 다시 그리게 만든다.
          return Math.abs(normalizeAngleDelta(smoothed - previous)) < HEADING_UPDATE_THRESHOLD_DEGREES ? previous : smoothed;
        });
      });
    }

    void subscribe();

    return () => {
      isMounted = false;
      positionSubscription?.remove();
      headingSubscription?.remove();
    };
  }, []);

  return { coords, heading, permissionDenied };
}
