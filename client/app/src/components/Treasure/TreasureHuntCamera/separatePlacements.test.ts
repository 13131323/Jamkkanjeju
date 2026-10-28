import { describe, expect, it } from 'vitest';
import { MIN_ICON_EDGE_GAP_PX, separateTreasurePlacements, STAGGER_STEP_PX } from './separatePlacements';
import type { TreasurePlacement } from './geoPlacement';

const SCREEN = 360;

function placement(overrides: Partial<TreasurePlacement> = {}): TreasurePlacement {
  return {
    distanceMeters: 100,
    withinRadius: true,
    visible: true,
    nextWasVisible: true,
    clickable: true,
    screenX: 180,
    iconSize: 80,
    iconTop: 400,
    // 지터 0 = 정확히 중앙 기준선. 계단 순서를 확인하는 테스트만 이 값을 덮어쓴다
    verticalJitterPx: 0,
    labelGap: 8,
    labelSize: 'near',
    ...overrides,
  };
}

/** 두 배치의 아이콘이 가로로 겹치는지 */
function overlapsHorizontally(a: TreasurePlacement, b: TreasurePlacement): boolean {
  const required = a.iconSize / 2 + b.iconSize / 2 + MIN_ICON_EDGE_GAP_PX;
  return Math.abs(a.screenX - b.screenX) < required - 0.001;
}

/**
 * step2는 보물의 방위각으로 screenX를, 거리로 iconSize·iconTop을 정한다. 그런데 서버가 한 장소에
 * 보물 셋을 가까이 놓으므로 방위각도 거리도 비슷해져 아이콘이 같은 자리에 겹쳐 그려졌다.
 * 그 상태에서는 탭이 위에 있는 하나로만 들어가 나머지를 찾을 수 없다.
 */
describe('separateTreasurePlacements', () => {
  it('겹치지 않는 배치는 그대로 둔다', () => {
    const input = [placement({ screenX: 60, iconSize: 60 }), placement({ screenX: 300, iconSize: 60 })];
    expect(separateTreasurePlacements(input, SCREEN)).toEqual(input);
  });

  it('같은 좌표에 몰린 둘을 최소 간격까지 벌린다', () => {
    const [a, b] = separateTreasurePlacements([placement({ screenX: 180 }), placement({ screenX: 182 })], SCREEN);
    expect(overlapsHorizontally(a, b)).toBe(false);
  });

  it('셋이 몰려도 서로 겹치지 않는다', () => {
    const spread = separateTreasurePlacements([placement({ screenX: 175 }), placement({ screenX: 180 }), placement({ screenX: 185 })], SCREEN);

    for (let i = 0; i < spread.length; i += 1) {
      for (let j = i + 1; j < spread.length; j += 1) {
        expect(overlapsHorizontally(spread[i], spread[j])).toBe(false);
      }
    }
  });

  it('벌린 뒤에도 화면 안에 남는다 — 밖으로 밀려나면 탭할 수 없다', () => {
    const spread = separateTreasurePlacements([placement({ screenX: 8 }), placement({ screenX: 10 }), placement({ screenX: 12 })], SCREEN);

    for (const item of spread) {
      expect(item.screenX - item.iconSize / 2).toBeGreaterThanOrEqual(-0.001);
      expect(item.screenX + item.iconSize / 2).toBeLessThanOrEqual(SCREEN + 0.001);
    }
  });

  it('입력 순서를 유지한다 — 호출부가 보물 index로 결과를 짝지어 쓴다', () => {
    const spread = separateTreasurePlacements([placement({ screenX: 200, distanceMeters: 10 }), placement({ screenX: 100, distanceMeters: 20 })], SCREEN);
    expect(spread[0].distanceMeters).toBe(10);
    expect(spread[1].distanceMeters).toBe(20);
  });

  it('왼쪽에 있던 아이콘이 자리를 지키고 오른쪽 것이 밀린다 — 화면 순서가 방위와 어긋나면 안 된다', () => {
    const [left, right] = separateTreasurePlacements([placement({ screenX: 180 }), placement({ screenX: 184 })], SCREEN);
    expect(left.screenX).toBe(180);
    expect(right.screenX).toBeGreaterThan(184);
  });

  it('몰려 있던 아이콘은 top을 계단식으로 어긋내 탭 영역이 겹치지 않게 한다', () => {
    const spread = separateTreasurePlacements([placement({ screenX: 180, iconTop: 400 }), placement({ screenX: 182, iconTop: 400 })], SCREEN);
    // 둘이면 중앙(0.5)을 기준으로 위아래 반 칸씩 — 아래로만 내리면 화면 중앙 기준이 무너진다
    expect(spread[0].iconTop).toBe(400 - STAGGER_STEP_PX / 2);
    expect(spread[1].iconTop).toBe(400 + STAGGER_STEP_PX / 2);
  });

  it('원래 떨어져 있던 아이콘의 top은 건드리지 않는다', () => {
    const spread = separateTreasurePlacements([placement({ screenX: 60, iconSize: 60, iconTop: 400 }), placement({ screenX: 300, iconSize: 60, iconTop: 420 })], SCREEN);
    expect(spread[0].iconTop).toBe(400);
    expect(spread[1].iconTop).toBe(420);
  });

  it('보이지 않는 배치는 간격 계산에서 빼고 값도 그대로 둔다', () => {
    const hidden = placement({ screenX: 181, visible: false });
    const [shown, untouched] = separateTreasurePlacements([placement({ screenX: 180 }), hidden], SCREEN);
    expect(shown.screenX).toBe(180);
    expect(untouched).toEqual(hidden);
  });

  it('빈 목록과 한 개짜리는 그대로 돌려준다', () => {
    expect(separateTreasurePlacements([], SCREEN)).toEqual([]);
    const single = [placement()];
    expect(separateTreasurePlacements(single, SCREEN)).toEqual(single);
  });

  it('화면보다 아이콘 합이 넓으면 화면 안 유지를 우선한다 — 겹쳐도 밖으로 내보내지 않는다', () => {
    const wide = [placement({ screenX: 180, iconSize: 200 }), placement({ screenX: 182, iconSize: 200 })];
    for (const item of separateTreasurePlacements(wide, SCREEN)) {
      expect(item.screenX - item.iconSize / 2).toBeGreaterThanOrEqual(-0.001);
      expect(item.screenX + item.iconSize / 2).toBeLessThanOrEqual(SCREEN + 0.001);
    }
  });
});

/**
 * everSeen sticky(TreasureHuntCamera)는 시야를 벗어난 보물도 계속 그린다. 그 보물의 screenX는
 * 방위각 그대로라 화면 밖이므로, 여기서 가두지 않으면 "보이는데 안 보이는" 상태가 된다.
 */
describe('separateTreasurePlacements — 시야 밖 보물도 화면 안에 세운다', () => {
  it('하나뿐이어도 화면 밖이면 안으로 가둔다', () => {
    const [only] = separateTreasurePlacements([placement({ screenX: -400, iconSize: 60 })], SCREEN);
    expect(only.screenX).toBe(30);
  });

  it('오른쪽으로 벗어난 하나도 가둔다', () => {
    const [only] = separateTreasurePlacements([placement({ screenX: 900, iconSize: 60 })], SCREEN);
    expect(only.screenX).toBe(SCREEN - 30);
  });

  it('가둘 필요가 없으면 top을 건드리지 않는다 — 계단은 겹칠 때만이다', () => {
    const single = [placement({ screenX: 180, iconTop: 360 })];
    expect(separateTreasurePlacements(single, SCREEN)).toEqual(single);
  });

  it('계단은 중앙을 기준으로 위아래로 펼친다', () => {
    const spread = separateTreasurePlacements([placement({ screenX: 178, iconTop: 360 }), placement({ screenX: 180, iconTop: 360 }), placement({ screenX: 182, iconTop: 360 })], SCREEN);
    expect(spread[0].iconTop).toBe(360 - STAGGER_STEP_PX);
    expect(spread[1].iconTop).toBe(360);
    expect(spread[2].iconTop).toBe(360 + STAGGER_STEP_PX);
  });
});

/**
 * 계단 자체는 겹침을 푸는 장치라 그대로 두되, **칸을 나눠 주는 순서**를 x가 아니라
 * 세로 지터 순서로 바꿨다. x 순서대로 내리면 그게 정의상 완벽한 대각선이기 때문이다.
 */
describe('separateTreasurePlacements — 계단 순서', () => {
  it('x 순서와 위아래 순서가 일치하지 않을 수 있다 (대각선이 아니다)', () => {
    // 왼쪽부터 x=175,180,185인데 지터는 가운데 것이 가장 위(-40)다.
    // x 순서대로 칸을 나눴다면 가운데가 항상 중간 칸이어야 한다.
    const spread = separateTreasurePlacements(
      [
        placement({ screenX: 175, verticalJitterPx: 10, iconTop: 410 }),
        placement({ screenX: 180, verticalJitterPx: -40, iconTop: 360 }),
        placement({ screenX: 185, verticalJitterPx: 30, iconTop: 430 }),
      ],
      SCREEN,
    );

    const byX = [...spread].sort((a, b) => a.screenX - b.screenX);
    // 가운데(x 기준)가 가장 위에 있다 — x 순서 계단이었다면 불가능한 배치다
    expect(byX[1].iconTop).toBeLessThan(byX[0].iconTop);
    expect(byX[1].iconTop).toBeLessThan(byX[2].iconTop);
  });

  it('계단 간격은 그대로 보장된다 — 순서만 바꿨지 겹침 방지를 포기한 게 아니다', () => {
    const spread = separateTreasurePlacements(
      [
        placement({ screenX: 175, verticalJitterPx: 10, iconTop: 410 }),
        placement({ screenX: 180, verticalJitterPx: -40, iconTop: 360 }),
        placement({ screenX: 185, verticalJitterPx: 30, iconTop: 430 }),
      ],
      SCREEN,
    );

    const tops = spread.map((item) => item.iconTop).sort((a, b) => a - b);
    expect(tops[1] - tops[0]).toBeCloseTo(STAGGER_STEP_PX, 5);
    expect(tops[2] - tops[1]).toBeCloseTo(STAGGER_STEP_PX, 5);
  });

  it('계단을 얹어도 무리의 세로 중심은 중앙 기준선에 남는다', () => {
    const input = [
      placement({ screenX: 175, verticalJitterPx: 10, iconTop: 410 }),
      placement({ screenX: 180, verticalJitterPx: -40, iconTop: 360 }),
      placement({ screenX: 185, verticalJitterPx: 30, iconTop: 430 }),
    ];
    // 셋 다 iconSize가 같으므로 중앙 기준선도 같다(iconTop - verticalJitterPx = 400)
    const spread = separateTreasurePlacements(input, SCREEN);

    const average = spread.reduce((sum, item) => sum + item.iconTop, 0) / spread.length;
    expect(average).toBeCloseTo(400, 5);
  });

  it('verticalJitterPx는 언제나 "iconTop - 중앙 기준선"으로 유지된다', () => {
    const spread = separateTreasurePlacements(
      [
        placement({ screenX: 175, verticalJitterPx: 10, iconTop: 410 }),
        placement({ screenX: 180, verticalJitterPx: -40, iconTop: 360 }),
        placement({ screenX: 185, verticalJitterPx: 30, iconTop: 430 }),
      ],
      SCREEN,
    );

    for (const item of spread) {
      expect(item.iconTop - item.verticalJitterPx).toBeCloseTo(400, 5);
    }
  });

  it('같은 입력이면 언제나 같은 결과 — 프레임마다 계단이 뒤바뀌면 안 된다', () => {
    const build = () => [
      placement({ screenX: 175, verticalJitterPx: 10, iconTop: 410 }),
      placement({ screenX: 180, verticalJitterPx: -40, iconTop: 360 }),
      placement({ screenX: 185, verticalJitterPx: 30, iconTop: 430 }),
    ];

    expect(separateTreasurePlacements(build(), SCREEN)).toEqual(separateTreasurePlacements(build(), SCREEN));
  });

  it('지터가 같아도 순서가 흔들리지 않는다 (입력 순서로 갈라 안정 정렬)', () => {
    const build = () => [placement({ screenX: 175, verticalJitterPx: 0, iconTop: 400 }), placement({ screenX: 180, verticalJitterPx: 0, iconTop: 400 })];

    expect(separateTreasurePlacements(build(), SCREEN)).toEqual(separateTreasurePlacements(build(), SCREEN));
  });

  it('겹치지 않으면 계단을 얹지 않는다 — 지터가 준 자리를 그대로 지킨다', () => {
    const input = [placement({ screenX: 60, iconSize: 60, verticalJitterPx: 25, iconTop: 395 }), placement({ screenX: 300, iconSize: 60, verticalJitterPx: -25, iconTop: 345 })];

    expect(separateTreasurePlacements(input, SCREEN)).toEqual(input);
  });
});
