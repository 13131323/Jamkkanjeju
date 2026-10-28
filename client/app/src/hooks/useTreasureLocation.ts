import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { TREASURE_DEV_APPROACH_BEARING_DEG, TREASURE_DEV_APPROACH_DISTANCES, TREASURE_DEV_APPROACH_STEP_MS } from '@/constants/treasureSpots';
import { useJudgeModeStore } from '@/store/judgeMode';
import { isValidHeading, normalizeAngleDelta, smoothHeading, type Coords } from '@/utils/geo';
import { resolveApproachCoords } from '@/utils/treasureApproachSimulation';

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

/**
 * 보물찾기 화면 공용 위치·나침반 구독.
 *
 * step0(지도)와 step2(카메라)가 같은 구독 코드를 각자 들고 있었다. 두 화면이 반경 판정에
 * 같은 좌표를 써야 하므로 한 곳으로 모았다.
 *
 * trueHeading 사용 — magHeading은 자북 기준이라 제주 기준 편차만큼 어긋난다
 * (docs/trouble/2026-08-15-treasure-hunt-tech-decisions.md §3/§4 함정 표: "자북 vs 진북").
 *
 * 심사위원용 모드가 켜져 있으면 위치만 시뮬레이션 좌표로 대체한다 — 보물 쪽으로 자동으로
 * 걸어가므로 제주 밖에서도 반경 진입까지 볼 수 있다(constants/treasureSpots.ts).
 * 꺼져 있으면 실제 좌표를 그대로 따라간다.
 * 권한 요청과 나침반 구독은 어느 쪽이든 그대로 두므로 실제 플로우(권한 거부 분기 등)는 계속 확인할 수 있다.
 *
 * @param approachTarget 시뮬레이션이 다가갈 보물의 좌표.
 *   보물 좌표는 진행도마다 서버가 새로 뽑으므로 훅이 상수로 알 수 없다 — 시작 응답을 받은 화면이
 *   골라 넘긴다(utils/treasureApproachSimulation.ts의 resolveApproachTarget).
 *   null이면 흘려보낼 목표가 없으므로 시뮬레이션은 대기한다.
 */
export function useTreasureLocation(approachTarget: Coords | null = null): TreasureLocation {
  // 시뮬레이션 스위치가 곧 심사위원용 모드다. 실행 중에 토글되므로 구독해야 하고,
  // 값이 바뀌면 아래 두 effect가 다시 걸려 구독/타이머가 서로 자리를 바꾼다.
  const isApproachSimulated = useJudgeModeStore((state) => state.enabled);
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

      // 시뮬레이션 중에는 실제 좌표가 들어오면 mock을 덮어써 버리므로 위치 구독을 걸지 않는다.
      // (나침반은 그대로 구독한다 — step2의 방위각 배치를 실기기에서 확인할 수 있어야 한다)
      if (!isApproachSimulated) {
        positionSubscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0 }, (location) => {
          setCoords({ latitude: location.coords.latitude, longitude: location.coords.longitude });
        });
      }

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
  }, [isApproachSimulated]);

  // 보물에 걸어서 다가가는 좌표를 흘려보낸다(심사위원용 모드에서만).
  // 권한과 무관하게 돌린다 — 권한을 거부한 상태에서도 화면 자체는 확인할 수 있어야 한다.
  //
  // 목표 좌표를 객체가 아니라 위도·경도로 쪼개 의존성에 넣는다. 화면이 매 렌더마다 새 객체를
  // 만들어 넘겨도 좌표가 같으면 타이머를 다시 걸지 않아야 한다(다시 걸리면 tick이 0으로 돌아가
  // 거리 진행이 처음부터 반복된다).
  const targetLatitude = approachTarget?.latitude ?? null;
  const targetLongitude = approachTarget?.longitude ?? null;
  useEffect(() => {
    if (!isApproachSimulated) return;
    // 시작 응답이 오기 전에는 다가갈 보물이 없다. 좌표가 들어오면 이 effect가 다시 돌며 시작한다.
    if (targetLatitude === null || targetLongitude === null) return;

    const target = { latitude: targetLatitude, longitude: targetLongitude };
    let tick = 0;
    function emit() {
      const next = resolveApproachCoords(target, tick, TREASURE_DEV_APPROACH_DISTANCES, TREASURE_DEV_APPROACH_BEARING_DEG);
      if (next) setCoords(next);
      tick += 1;
    }

    // 첫 좌표는 바로 흘려보낸다 — 지도의 현재 위치 마커가 3초 넘게 비어 있지 않게 한다.
    // 이 setState는 타이머(외부 시스템)가 밀어주는 값을 편입하는 동작이라 렌더 연쇄가 아니다.
    emit();
    const timer = setInterval(emit, TREASURE_DEV_APPROACH_STEP_MS);
    return () => clearInterval(timer);
  }, [isApproachSimulated, targetLatitude, targetLongitude]);

  return { coords, heading, permissionDenied };
}
