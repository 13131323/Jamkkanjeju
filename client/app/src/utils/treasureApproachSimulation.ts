import { destinationCoords, haversineDistanceMeters, type Coords } from './geo';

/**
 * [테스트용] 보물에 걸어서 다가가는 좌표열을 만드는 순수 함수.
 *
 * 실기기가 제주 밖에 있으면 보물과 수백 km 떨어져서 접근 안내 토스트·step1 시트를 확인할 수 없다.
 * 심사위원용 모드의 접근 시뮬레이션(constants/treasureSpots.ts)이 이 함수를 tick마다 호출해
 * "반경 밖(600m) → 반경 진입(500m) → 계속 접근"을 재현한다.
 *
 * 부수효과(타이머·구독)는 훅이 맡고, 여기에는 계산만 둔다 — geo.ts와 같은 규칙이다.
 */

/**
 * tick 번째에 머물 거리(m).
 *
 * 목록 끝에 도달하면 마지막 값에 머문다 — 계속 줄이면 좌표가 보물을 지나쳐 다시 멀어지고,
 * 그러면 "다 왔는데 또 500m" 같은 이상한 진행이 보인다.
 */
export function resolveApproachDistance(tick: number, distances: readonly number[]): number | null {
  if (distances.length === 0) return null;

  const index = Math.min(Math.max(tick, 0), distances.length - 1);
  return distances[index];
}

/**
 * tick 번째의 현재 위치. 목표 보물에서 bearingDeg 방향으로 해당 거리만큼 떨어진 지점이다.
 *
 * "보물에서 뒤로 물러난 지점"으로 계산하는 이유: 거리를 직접 지정할 수 있어서 반경 경계값
 * (TREASURE_ENTER_RADIUS_METERS = 500)을 정확히 밟는다. 출발점을 정해 두고 보물 쪽으로 걸어가게
 * 만들면 경계에 딱 맞게 떨어지지 않아 "반경에 들어서는 순간"을 놓칠 수 있다.
 */
export function resolveApproachCoords(target: Coords, tick: number, distances: readonly number[], bearingDeg: number): Coords | null {
  const distance = resolveApproachDistance(tick, distances);
  if (distance === null) return null;

  return destinationCoords(target, distance, bearingDeg);
}

/**
 * 시뮬레이션이 다가갈 보물을 고른다.
 *
 * 예전에는 목표를 상수(TREASURE_DEV_APPROACH_TARGET_ID = 'dolmeong')로 못 박아 두고, mock 좌표가
 * 그 조건을 만족한다는 것을 테스트로 지켰다. 서버는 진행도를 만들 때마다 보물 좌표를 새로 뽑으므로
 * 그 방식이 성립하지 않는다 — 그래서 좌표를 받은 뒤에 조건을 만족하는 보물을 찾는다.
 *
 * 조건: **모든 단계에서 그 보물이 계속 "가장 가까운 보물"로 남는다.**
 * 접근 안내 토스트·step1 시트는 "가장 가까운 남은 보물"까지의 거리로 판정하는데, 중간에 다른 보물이
 * 더 가까워지면 그 거리가 단계값을 밟지 않는다. 그러면 반경 경계(500m)를 정확히 지나는 순간이
 * 사라져 토스트 → 시트 전환을 확인할 수 없다. 후보가 여러 개면 앞선 순번을 쓴다 —
 * 1번째 보물이 AR 캐릭터라 촬영(step3)까지 확인할 수 있는 유일한 보물이기 때문이다.
 *
 * 조건을 만족하는 보물이 없으면 첫 보물을 그대로 쓴다. 중간 문구 몇 개를 건너뛰더라도 시뮬레이션이
 * 아예 멈추는 것보다는 낫다(그러면 실기기에서 카메라까지 도달할 방법이 없다).
 */
export function resolveApproachTarget<T extends { coords: Coords }>(treasures: readonly T[], distances: readonly number[], bearingDeg: number): T | null {
  if (treasures.length === 0) return null;

  for (const candidate of treasures) {
    const others = treasures.filter((treasure) => treasure !== candidate);

    const staysNearest = distances.every((_, tick) => {
      const current = resolveApproachCoords(candidate.coords, tick, distances, bearingDeg);
      if (!current) return false;

      const candidateDistance = haversineDistanceMeters(current, candidate.coords);
      return others.every((other) => haversineDistanceMeters(current, other.coords) > candidateDistance);
    });

    if (staysNearest) return candidate;
  }

  return treasures[0];
}
