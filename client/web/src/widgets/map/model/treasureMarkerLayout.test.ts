import { describe, expect, it } from 'vitest';
import { resolveTreasureCluster, resolveTreasureMarkerMode } from './treasureMarkerLayout';
import { DETAIL_ENTRY_LEVEL, levelToTier, WIDE_SPLIT_ENTRY_LEVEL } from './useMapZoomTier';
import type { TreasureMarkersState } from './useTreasureMarkersBridge';

function treasure(order: number, lat: number, lng: number, found = false) {
  return { treasureId: String(order), order, lat, lng, found };
}

function state(partial: Partial<TreasureMarkersState>): TreasureMarkersState {
  return { center: null, treasures: [], ...partial };
}

describe('resolveTreasureMarkerMode', () => {
  it('detail 티어(1~5)에서만 보물별 개별 마커를 그린다', () => {
    expect(resolveTreasureMarkerMode('detail')).toBe('individual');
  });

  it('축소 티어(wideSplit 6~7 / wide 8~9)에서는 장소 대표 마커 1개로 묶는다', () => {
    expect(resolveTreasureMarkerMode('wideSplit')).toBe('clustered');
    expect(resolveTreasureMarkerMode('wide')).toBe('clustered');
  });
});

describe('resolveTreasureCluster', () => {
  it('보물이 없으면 그릴 게 없다', () => {
    expect(resolveTreasureCluster(state({}))).toBeNull();
  });

  it('center가 있으면 미션 장소 좌표를 그대로 쓴다', () => {
    const result = resolveTreasureCluster(
      state({
        center: { lat: 33.4, lng: 126.6 },
        treasures: [treasure(1, 33.1, 126.1), treasure(2, 33.2, 126.2)],
      }),
    );
    expect(result?.coords).toEqual({ lat: 33.4, lng: 126.6 });
  });

  it('center가 없으면 보물 좌표의 무게중심으로 떨어진다', () => {
    const result = resolveTreasureCluster(state({ treasures: [treasure(1, 33.0, 126.0), treasure(2, 33.2, 126.4)] }));
    expect(result?.coords.lat).toBeCloseTo(33.1);
    expect(result?.coords.lng).toBeCloseTo(126.2);
  });

  it('배지는 남은 보물 수를 보여준다', () => {
    const result = resolveTreasureCluster(state({ treasures: [treasure(1, 33, 126, true), treasure(2, 33, 126), treasure(3, 33, 126)] }));
    expect(result?.totalCount).toBe(3);
    expect(result?.remainingCount).toBe(2);
    expect(result?.badgeLabel).toBe('2');
    // 일부만 찾은 상태는 아직 닫힌 상자
    expect(result?.allFound).toBe(false);
  });

  it('남은 보물이 3개를 넘으면 3으로 잘라 보여준다 (prompt §9)', () => {
    const treasures = [1, 2, 3, 4, 5].map((order) => treasure(order, 33, 126));
    const result = resolveTreasureCluster(state({ treasures }));
    expect(result?.remainingCount).toBe(5);
    expect(result?.badgeLabel).toBe('3');
  });

  it('전부 찾으면 배지를 숨기고 열린 상자로 바뀐다', () => {
    const result = resolveTreasureCluster(state({ treasures: [treasure(1, 33, 126, true), treasure(2, 33, 126, true)] }));
    expect(result?.remainingCount).toBe(0);
    expect(result?.badgeLabel).toBeNull();
    expect(result?.allFound).toBe(true);
  });
});

// 실제 levelToTier를 통과시켜 "어느 레벨에서 무엇이 그려지는지"를 레벨 단위로 못박아둔다.
// DETAIL_ENTRY_LEVEL(5)은 대표 마커를 눌렀을 때 확대해서 진입하는 레벨이고, 그 지점부터 개별 마커여야 한다.
describe('줌 레벨별 마커 형태', () => {
  it('DETAIL_ENTRY_LEVEL(5) 이하는 개별, 6 이상은 대표 마커', () => {
    const table = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => [level, resolveTreasureMarkerMode(levelToTier(level))]);
    expect(table).toEqual([
      [1, 'individual'],
      [2, 'individual'],
      [3, 'individual'],
      [4, 'individual'],
      [5, 'individual'],
      [6, 'clustered'],
      [7, 'clustered'],
      [8, 'clustered'],
      [9, 'clustered'],
    ]);
    expect(DETAIL_ENTRY_LEVEL).toBe(5);
    expect(WIDE_SPLIT_ENTRY_LEVEL).toBe(7);
  });
});
