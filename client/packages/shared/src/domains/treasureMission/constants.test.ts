import { describe, expect, it } from 'vitest';
import { resolveTreasureDistanceHint, TREASURE_APPROACH_HINT, TREASURE_ENTER_RADIUS_METERS, TREASURE_KEEP_RADIUS_METERS } from './constants';

/**
 * 이 판정은 한 번 뒤집힌 적이 있다 — 예전에는 반경 **안**에서 거리 구간별 문구를 띄웠고,
 * 지금은 반경 **밖**에서만 띄운다(안으로 들어오면 step1 시트가 대신 뜬다).
 * 조건을 되돌리면 토스트와 시트가 같은 자리에서 겹치므로 경계를 못박아 둔다.
 */
describe('resolveTreasureDistanceHint', () => {
  it('반경 밖에서는 접근 안내를 띄운다', () => {
    expect(resolveTreasureDistanceHint(TREASURE_ENTER_RADIUS_METERS + 1)).toBe(TREASURE_APPROACH_HINT);
    expect(resolveTreasureDistanceHint(1200)).toBe(TREASURE_APPROACH_HINT);
    // 유지 반경(1km)을 벗어난 거리도 "밖"이라 같은 안내다
    expect(resolveTreasureDistanceHint(TREASURE_KEEP_RADIUS_METERS + 1)).toBe(TREASURE_APPROACH_HINT);
  });

  it('반경 안에서는 문구가 없다 — 토스트 대신 step1 시트가 뜬다', () => {
    expect(resolveTreasureDistanceHint(TREASURE_ENTER_RADIUS_METERS)).toBeNull();
    expect(resolveTreasureDistanceHint(499)).toBeNull();
    expect(resolveTreasureDistanceHint(30)).toBeNull();
    expect(resolveTreasureDistanceHint(0)).toBeNull();
  });

  it('경계값(500)은 "안"으로 다룬다 — 시트가 열리는 조건과 같아야 한다', () => {
    // resolveSheetVisibility가 `distance <= TREASURE_ENTER_RADIUS_METERS`로 열기 때문에,
    // 여기서 500을 "밖"으로 보면 딱 500m에서 토스트와 시트가 동시에 뜬다.
    expect(resolveTreasureDistanceHint(TREASURE_ENTER_RADIUS_METERS)).toBeNull();
    expect(resolveTreasureDistanceHint(TREASURE_ENTER_RADIUS_METERS + 0.5)).toBe(TREASURE_APPROACH_HINT);
  });

  it('문구에 박힌 거리는 반경 상수와 같다 — 반경을 바꿔도 문구가 어긋나지 않는다', () => {
    expect(TREASURE_APPROACH_HINT).toContain(`${TREASURE_ENTER_RADIUS_METERS}m`);
  });
});
