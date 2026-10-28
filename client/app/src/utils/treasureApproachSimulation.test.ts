import { describe, expect, it } from 'vitest';
import { TREASURE_DEV_APPROACH_BEARING_DEG, TREASURE_DEV_APPROACH_DISTANCES } from '@/constants/treasureSpots';
import { destinationCoords, haversineDistanceMeters } from './geo';
import { resolveApproachCoords, resolveApproachDistance, resolveApproachTarget } from './treasureApproachSimulation';

const distances = [600, 500, 400] as const;
const target = { latitude: 33.5008, longitude: 126.5312 };

describe('resolveApproachDistance', () => {
  it('tick 순서대로 거리를 돌려준다', () => {
    expect(resolveApproachDistance(0, distances)).toBe(600);
    expect(resolveApproachDistance(1, distances)).toBe(500);
    expect(resolveApproachDistance(2, distances)).toBe(400);
  });

  it('끝에 도달하면 마지막 거리에 머문다 — 보물을 지나쳐 다시 멀어지지 않는다', () => {
    expect(resolveApproachDistance(3, distances)).toBe(400);
    expect(resolveApproachDistance(99, distances)).toBe(400);
  });

  it('빈 목록이면 null', () => {
    expect(resolveApproachDistance(0, [])).toBeNull();
  });
});

describe('resolveApproachCoords', () => {
  it('목표 보물에서 지정한 거리만큼 떨어진 좌표를 만든다', () => {
    for (let tick = 0; tick < distances.length; tick++) {
      const coords = resolveApproachCoords(target, tick, distances, 0);
      expect(coords).not.toBeNull();
      // haversine과 destinationCoords가 서로 역연산이므로 거리가 그대로 복원된다
      expect(haversineDistanceMeters(coords!, target)).toBeCloseTo(distances[tick], 0);
    }
  });

  it('정북(0도) 접근이면 보물보다 북쪽에 놓인다', () => {
    const coords = resolveApproachCoords(target, 0, distances, 0);
    expect(coords!.latitude).toBeGreaterThan(target.latitude);
    expect(coords!.longitude).toBeCloseTo(target.longitude, 6);
  });
});

describe('resolveApproachTarget', () => {
  /** 기준점에서 bearing 방향으로 meters만큼 떨어진 보물 하나 */
  function spotAt(meters: number, bearingDeg: number) {
    return { coords: destinationCoords(target, meters, bearingDeg) };
  }

  it('모든 단계에서 계속 가장 가까운 보물로 남는 후보를 고른다', () => {
    // bearing 0은 "보물의 북쪽에서 다가온다"는 뜻이라, 북쪽 보물이 끝까지 더 가깝다.
    // 남쪽 보물을 목표로 잡으면 다가가는 도중 북쪽 보물이 먼저 가까워져 거리 진행이 어긋난다.
    const northern = spotAt(150, 0);
    const southern = spotAt(150, 180);

    const chosen = resolveApproachTarget([southern, northern], TREASURE_DEV_APPROACH_DISTANCES, TREASURE_DEV_APPROACH_BEARING_DEG);

    expect(chosen).toBe(northern);
  });

  it('고른 목표는 실제로 전 구간에서 가장 가깝다 — 거리 진행이 단계값을 그대로 밟는다', () => {
    // 서버가 뽑는 좌표처럼 서로 100m 안쪽에 흩어진 세 보물
    const treasures = [spotAt(80, 20), spotAt(60, 200), spotAt(95, 250)];

    const chosen = resolveApproachTarget(treasures, TREASURE_DEV_APPROACH_DISTANCES, TREASURE_DEV_APPROACH_BEARING_DEG)!;
    const others = treasures.filter((treasure) => treasure !== chosen);

    for (let tick = 0; tick < TREASURE_DEV_APPROACH_DISTANCES.length; tick++) {
      const coords = resolveApproachCoords(chosen.coords, tick, TREASURE_DEV_APPROACH_DISTANCES, TREASURE_DEV_APPROACH_BEARING_DEG)!;
      const chosenDistance = haversineDistanceMeters(coords, chosen.coords);

      for (const other of others) {
        expect(haversineDistanceMeters(coords, other.coords)).toBeGreaterThan(chosenDistance);
      }
    }
  });

  it('후보가 하나면 그 보물을 그대로 쓴다', () => {
    const only = spotAt(50, 0);

    expect(resolveApproachTarget([only], TREASURE_DEV_APPROACH_DISTANCES, TREASURE_DEV_APPROACH_BEARING_DEG)).toBe(only);
  });

  it('조건을 만족하는 보물이 없으면 첫 보물로 받친다 — 시뮬레이션이 멈추면 카메라까지 갈 수 없다', () => {
    // 같은 좌표에 겹쳐 있으면 "더 멀다"는 조건을 아무도 만족하지 못한다
    const overlapping = [{ coords: target }, { coords: target }];

    expect(resolveApproachTarget(overlapping, TREASURE_DEV_APPROACH_DISTANCES, TREASURE_DEV_APPROACH_BEARING_DEG)).toBe(overlapping[0]);
  });

  it('보물이 없으면 null — 시작 응답을 기다리는 동안의 상태다', () => {
    expect(resolveApproachTarget([], TREASURE_DEV_APPROACH_DISTANCES, TREASURE_DEV_APPROACH_BEARING_DEG)).toBeNull();
  });
});
