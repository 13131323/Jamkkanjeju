import { describe, expect, it } from 'vitest';
import { centeredIconTop } from './geoPlacement';
import { hashToUnitInterval, JITTER_BOTTOM_SAFE_RATIO, JITTER_TOP_SAFE_RATIO, resolveVerticalJitter, VERTICAL_JITTER_RATIO } from './verticalJitter';

const SCREEN_HEIGHT = 800;

function jitterFor(seed: string | number, iconSize = 100) {
  return resolveVerticalJitter({ seed, iconSize, screenHeightPx: SCREEN_HEIGHT, centeredTop: centeredIconTop(iconSize, SCREEN_HEIGHT) });
}

describe('hashToUnitInterval', () => {
  it('같은 씨앗은 항상 같은 값 — 프레임마다 다시 계산해도 아이콘이 떨리면 안 된다', () => {
    for (const seed of [0, 1, 2, 3, 'a', 'treasure-1']) {
      expect(hashToUnitInterval(seed)).toBe(hashToUnitInterval(seed));
    }
  });

  it('항상 [0, 1) 안이다', () => {
    for (let seed = 0; seed < 500; seed += 1) {
      const value = hashToUnitInterval(seed);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  /**
   * FNV-1a만 쓰던 판(마무리 혼합 없음)에서 이 테스트가 실제로 깨졌다 — 세 값의 간격이 0.0039로,
   * 800px 화면에서 1px도 안 되는 차이였다. 임계값 0.05는 그 실패를 다시 잡을 만큼 크고
   * (실패했던 값의 12배), 잘 섞인 해시가 우연히 걸리지 않을 만큼 작다.
   * 눈에 보이는 실제 보장은 아래 resolveVerticalJitter의 px 단위 테스트가 맡는다.
   */
  it('1·2·3처럼 붙어 있는 id도 서로 흩어진다 — 안 그러면 다시 한 줄로 선다', () => {
    const values = [1, 2, 3].map(hashToUnitInterval);

    for (let i = 0; i < values.length; i += 1) {
      for (let j = i + 1; j < values.length; j += 1) {
        expect(Math.abs(values[i] - values[j])).toBeGreaterThan(0.05);
      }
    }
  });

  it('숫자와 그 숫자의 문자열은 같은 값이다 — 씨앗 타입이 바뀌어도 자리가 안 바뀐다', () => {
    expect(hashToUnitInterval(7)).toBe(hashToUnitInterval('7'));
  });
});

describe('resolveVerticalJitter', () => {
  it('같은 입력은 항상 같은 오프셋 (Math.random을 쓰지 않는다는 보장)', () => {
    expect(jitterFor(1)).toBe(jitterFor(1));
    expect(jitterFor('treasure-2')).toBe(jitterFor('treasure-2'));
  });

  it('보물마다 다른 오프셋을 준다 — 이게 "정렬 안 된 느낌"의 실체다', () => {
    const offsets = [1, 2, 3].map((seed) => jitterFor(seed));

    expect(new Set(offsets).size).toBe(offsets.length);
  });

  it('오프셋 크기가 화면 높이 비율 한도 안이다', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      expect(Math.abs(jitterFor(seed))).toBeLessThanOrEqual(SCREEN_HEIGHT * VERTICAL_JITTER_RATIO + 0.001);
    }
  });

  it('위아래 어느 쪽으로도 흔든다 — 한 방향뿐이면 무리 전체가 치우친다', () => {
    const offsets = Array.from({ length: 50 }, (_, seed) => jitterFor(seed));

    expect(offsets.some((offset) => offset > 0)).toBe(true);
    expect(offsets.some((offset) => offset < 0)).toBe(true);
  });

  it('아이콘이 안전 구간(상단 안내/하단 UI 사이)을 벗어나지 않는다', () => {
    const minTop = SCREEN_HEIGHT * JITTER_TOP_SAFE_RATIO;
    const maxBottom = SCREEN_HEIGHT * JITTER_BOTTOM_SAFE_RATIO;

    // 가장 큰 아이콘(123)과 가장 작은 아이콘(61) 모두 확인한다
    for (const iconSize of [61, 100, 123]) {
      const centeredTop = centeredIconTop(iconSize, SCREEN_HEIGHT);
      for (let seed = 0; seed < 200; seed += 1) {
        const top = centeredTop + resolveVerticalJitter({ seed, iconSize, screenHeightPx: SCREEN_HEIGHT, centeredTop });
        expect(top).toBeGreaterThanOrEqual(minTop - 0.001);
        expect(top + iconSize).toBeLessThanOrEqual(maxBottom + 0.001);
      }
    }
  });

  it('안전 구간보다 아이콘이 크면 흔들지 않는다 (화면 안에 있는 것이 우선)', () => {
    const iconSize = SCREEN_HEIGHT; // 구간을 통째로 넘는 크기
    const centeredTop = centeredIconTop(iconSize, SCREEN_HEIGHT);

    expect(resolveVerticalJitter({ seed: 1, iconSize, screenHeightPx: SCREEN_HEIGHT, centeredTop })).toBe(0);
  });

  it('값이 없거나 0 이하인 입력은 흔들지 않는다', () => {
    expect(resolveVerticalJitter({ seed: 1, iconSize: 100, screenHeightPx: 0, centeredTop: 0 })).toBe(0);
    expect(resolveVerticalJitter({ seed: 1, iconSize: 0, screenHeightPx: SCREEN_HEIGHT, centeredTop: 0 })).toBe(0);
    expect(resolveVerticalJitter({ seed: 1, iconSize: 100, screenHeightPx: SCREEN_HEIGHT, centeredTop: 350, jitterRatio: 0 })).toBe(0);
  });

  it('전부 같은 값으로 몰리지 않는다 — 세 보물이 세로로 뚜렷이 갈려야 한다', () => {
    const offsets = [1, 2, 3].map((seed) => jitterFor(123));
    // 같은 씨앗이면 같아야 하고(결정론),
    expect(new Set(offsets).size).toBe(1);
    // 다른 씨앗이면 눈에 보일 만큼(>=8px) 갈려야 한다
    const distinct = [1, 2, 3].map((seed) => jitterFor(seed)).sort((a, b) => a - b);
    expect(distinct[1] - distinct[0]).toBeGreaterThan(8);
    expect(distinct[2] - distinct[1]).toBeGreaterThan(8);
  });
});
