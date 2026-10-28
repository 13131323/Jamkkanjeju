import { describe, expect, it } from 'vitest';
import { CELEBRATION_BASE_SIZE, COOP_CELEBRATION_SIZE, fixedContentHeight, resolveCelebrationRender, resolveCompleteLayout, scaleCelebrationSize } from './completeLayout';

/** 배율 대신 실제로 그려질 정사각 크기로 환산한다 — 기대값을 크기로 적으면 읽기 쉽다 */
function metricsAt(usableHeight: number, resultRowCount = 3) {
  const { celebrationScale, suggestionGap } = resolveCompleteLayout({ usableHeight, resultRowCount });

  return {
    celebration: scaleCelebrationSize({ width: CELEBRATION_BASE_SIZE, height: CELEBRATION_BASE_SIZE }, celebrationScale).width,
    suggestionGap,
  };
}

describe('resolveCompleteLayout', () => {
  it('큰 기기에서는 이미지를 상한 178까지, 간격을 40까지만 키운다', () => {
    expect(metricsAt(1000)).toEqual({ celebration: 178, suggestionGap: 44 });
    expect(metricsAt(1400)).toEqual({ celebration: 178, suggestionGap: 44 });
  });

  it('자리가 남는 동안 간격은 기기 높이에만 반응한다 — 낮아질수록 좁아진다', () => {
    // 행 0개라 이미지가 하한에 닿지 않는 구간이다. 간격 = clamp(높이 - 고정 콘텐츠(296) - 상한(178), 12, 44)
    expect(metricsAt(720, 0).suggestionGap).toBe(44);
    expect(metricsAt(522, 0).suggestionGap).toBe(44);
    expect(metricsAt(506, 0).suggestionGap).toBe(32);
    expect(metricsAt(490, 0).suggestionGap).toBe(16);
    // 더 낮아져도 하한(12) 아래로는 내려가지 않는다 — 나머지는 ScrollView가 처리한다
    expect(metricsAt(400, 0).suggestionGap).toBe(12);
  });

  /**
   * 사용자 지시: 중단으로 온 완료 화면(보상 0행)과 정상 완료(보상 3행)의 문구 위 여백이 달랐다.
   * 예산이 넉넉한 구간에서는 행 수가 간격을 흔들지 않아야 한다.
   */
  it('자리가 남는 기기라면 보상 행 수가 달라도 간격이 같다', () => {
    for (const usableHeight of [720, 800, 900]) {
      const gaps = [0, 1, 2, 3].map((rows) => metricsAt(usableHeight, rows).suggestionGap);

      expect(new Set(gaps).size).toBe(1);
    }
  });

  /**
   * 사용자 지시: 문구 위 여백은 최소 12px이고, 그보다 빠듯해지면 **여백이 먼저 양보해** 스크롤을 막는다.
   * 이미지가 하한(120)에 닿아 있는 동안 간격이 넓은 값을 쥐고 있으면 그만큼이 그대로 스크롤이 된다.
   */
  it('이미지가 하한에 닿을 만큼 빠듯하면 간격이 필요한 만큼만 양보한다(하한 12)', () => {
    // 3행: 예산 145 = 이미지 하한 120 + 간격 25 — 44에서 25까지만 내주고 멈춘다(딱 맞아 스크롤 없음)
    expect(metricsAt(640, 3)).toEqual({ celebration: 120, suggestionGap: 25 });
    // 2행부터는 자리가 남아 간격이 상한 그대로다
    expect(metricsAt(640, 2)).toEqual({ celebration: 153, suggestionGap: 44 });
    expect(metricsAt(640, 0)).toEqual({ celebration: 178, suggestionGap: 44 });
  });

  it('하한까지 다 내줘도 모자란 기기는 ScrollView가 받는다', () => {
    // 예산 125인데 이미지 하한 120 + 간격 하한 12 = 132이라 7px이 넘친다
    expect(metricsAt(620, 3)).toEqual({ celebration: 120, suggestionGap: 12 });
  });

  it('예산이 이미지 하한 + 간격 하한(132) 이상이면 스크롤이 생기지 않는다', () => {
    for (let height = 400; height <= 1000; height += 10) {
      for (const rows of [0, 1, 2, 3]) {
        const { celebration, suggestionGap } = metricsAt(height, rows);
        const budget = height - fixedContentHeight(rows);

        if (budget >= 132) {
          expect(celebration + suggestionGap).toBeLessThanOrEqual(budget);
        }
      }
    }
  });

  it('행 수가 같으면 높이가 커질수록 이미지가 줄지 않는다(단조 증가)', () => {
    const heights = [400, 500, 560, 600, 640, 670, 700, 760, 900];

    const sizes = heights.map((height) => metricsAt(height).celebration);

    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  it('높이가 같으면 행이 많아질수록 이미지가 커지지 않는다(단조 감소)', () => {
    const sizes = [0, 1, 2, 3].map((rows) => metricsAt(640, rows).celebration);

    expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
  });

  it('측정 전이거나 이상값이면 기존 값(배율 1, 디자인 간격 32)을 쓴다 — 이미지가 사라지면 안 된다', () => {
    for (const usableHeight of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolveCompleteLayout({ usableHeight, resultRowCount: 3 })).toEqual({ celebrationScale: 1, suggestionGap: 32 });
    }
  });

  it('어떤 높이·행 수 조합에서도 상하한을 벗어나지 않는다', () => {
    for (let height = 200; height <= 1400; height += 10) {
      for (const rows of [0, 1, 2, 3]) {
        const { celebration, suggestionGap } = metricsAt(height, rows);

        expect(celebration).toBeGreaterThanOrEqual(120);
        expect(celebration).toBeLessThanOrEqual(178);
        expect(suggestionGap).toBeGreaterThanOrEqual(12);
        expect(suggestionGap).toBeLessThanOrEqual(44);
      }
    }
  });

  it('음수 행 수도 0행과 같게 다룬다 — 계산이 음수로 새면 안 된다', () => {
    expect(metricsAt(620, -1)).toEqual(metricsAt(620, 0));
  });
});

describe('scaleCelebrationSize', () => {
  it('가로·세로에 같은 배율을 걸어 비율을 유지한다 — 협동의 171x176 합성 이미지', () => {
    const scaled = scaleCelebrationSize({ width: 171, height: 176 }, 0.8);

    expect(scaled).toEqual({ width: 137, height: 141 });
    // 원본 비율(171/176)이 반올림 오차 범위 안에서 유지된다
    expect(Math.abs(scaled.width / scaled.height - 171 / 176)).toBeLessThan(0.01);
  });

  it('배율 1이면 기준 크기를 그대로 돌려준다', () => {
    expect(scaleCelebrationSize({ width: 171, height: 176 }, 1)).toEqual({ width: 171, height: 176 });
    expect(scaleCelebrationSize({ width: CELEBRATION_BASE_SIZE, height: CELEBRATION_BASE_SIZE }, 1)).toEqual({ width: 164, height: 164 });
  });
});

/** 협동 완료 화면의 합성 에셋 — 유일하게 크기를 직접 지정하는 미션이다 */
const COOP_SIZE = COOP_CELEBRATION_SIZE;

describe('resolveCelebrationRender', () => {
  it('서버 그림과 번들 에셋이 같은 상자를 쓴다 — 크기를 지정하지 않는 문화·보물찾기', () => {
    const remote = resolveCelebrationRender({ scale: 1, isRemote: true });
    const bundled = resolveCelebrationRender({ scale: 1, isRemote: false });

    expect(remote.size).toEqual(bundled.size);
    expect(remote.size).toEqual({ width: CELEBRATION_BASE_SIZE, height: CELEBRATION_BASE_SIZE });
  });

  it('크기를 지정한 미션도 서버 그림에서 그 크기를 유지한다 — 협동이 171x176 ↔ 150x150으로 튀던 문제', () => {
    const remote = resolveCelebrationRender({ celebrationSize: COOP_SIZE, scale: 1, isRemote: true });
    const bundled = resolveCelebrationRender({ celebrationSize: COOP_SIZE, scale: 1, isRemote: false });

    expect(remote.size).toEqual(COOP_SIZE);
    expect(remote.size).toEqual(bundled.size);
  });

  it('기기 높이 배율이 두 경로에 똑같이 걸린다', () => {
    const scale = 0.8;

    expect(resolveCelebrationRender({ celebrationSize: COOP_SIZE, scale, isRemote: true }).size).toEqual(scaleCelebrationSize(COOP_SIZE, scale));
    expect(resolveCelebrationRender({ scale, isRemote: true }).size).toEqual(resolveCelebrationRender({ scale, isRemote: false }).size);
  });

  it('서버 그림은 자르지도 둥글리지도 않는다 — 비율도 여백도 알 수 없다', () => {
    const remote = resolveCelebrationRender({ scale: 1, isRemote: true });

    expect(remote.resizeMode).toBe('contain');
    expect(remote.borderRadius).toBe(0);
    // 크기를 지정해도 마찬가지다(협동의 radius 0 지정과 우연히 같아지는 게 아니다)
    expect(resolveCelebrationRender({ celebrationSize: COOP_SIZE, celebrationRadius: 24, scale: 1, isRemote: true }).borderRadius).toBe(0);
  });

  it('번들 에셋은 크기를 지정하지 않으면 원형 틀을 cover로 채운다', () => {
    const bundled = resolveCelebrationRender({ scale: 0.8, isRemote: false });

    expect(bundled.resizeMode).toBe('cover');
    // 배율이 바뀌어도 정원이어야 한다 — 고정값이면 축소 시 원이 깨진다
    expect(bundled.borderRadius).toBe(bundled.size.width / 2);
  });

  it('번들 에셋이라도 크기를 지정하면 자르지 않는다 — 합성 이미지의 여백까지 의미가 있다', () => {
    const bundled = resolveCelebrationRender({ celebrationSize: COOP_SIZE, celebrationRadius: 0, scale: 1, isRemote: false });

    expect(bundled.resizeMode).toBe('contain');
    expect(bundled.borderRadius).toBe(0);
  });
});

/**
 * 표준 크기를 150 → 164로 올린 변경(축하 이미지를 164~178로 통일)이 협동만 조용히
 * 줄이지 않았는지 본다. 협동은 정사각이 아니라 상자를 직접 지정하는데, 그 상자는 dp가 아니라
 * "표준 크기에 곱해질 값"이라 표준이 바뀌면 함께 환산해야 한다.
 */
describe('협동 축하 이미지 렌더 크기 유지', () => {
  /** 표준이 150이던 때의 협동 렌더 크기(디자인 배치 171x176 × 그때의 배율) */
  function legacyCoopSize(celebration: number) {
    return { width: Math.round(171 * (celebration / 150)), height: Math.round(176 * (celebration / 150)) };
  }

  it('예전 상한(164) 이하에서는 렌더 크기가 예전과 같다', () => {
    // 예전 상한 아래 구간에서만 비교한다 — 그 위는 상한이 178로 넓어진 의도된 변화다.
    //
    // 1dp까지 허용하는 이유: 환산한 기준값(187x192)이 이미 반올림된 정수라 배율을 곱할 때
    // 반올림이 두 번 걸린다. 예) 하한 120에서 높이가 141 대신 140이 된다. 눈에 보이지 않는 차이고,
    // 정확히 맞추려면 기준값을 소수로 들고 있어야 해서 그 편이 읽기 더 나쁘다.
    for (let height = 560; height <= 680; height += 10) {
      for (const rows of [0, 1, 2, 3]) {
        const { celebrationScale } = resolveCompleteLayout({ usableHeight: height, resultRowCount: rows });
        const celebration = Math.round(CELEBRATION_BASE_SIZE * celebrationScale);
        if (celebration > 164) continue;

        const now = scaleCelebrationSize(COOP_CELEBRATION_SIZE, celebrationScale);
        const before = legacyCoopSize(celebration);

        expect(Math.abs(now.width - before.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(now.height - before.height)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('배율 1이면 디자인 배치(171x176)를 표준 기준으로 환산한 값이다', () => {
    expect(COOP_CELEBRATION_SIZE).toEqual({ width: Math.round((171 * CELEBRATION_BASE_SIZE) / 150), height: Math.round((176 * CELEBRATION_BASE_SIZE) / 150) });
  });

  it('비율이 유지된다 — 합성 이미지가 눌리거나 늘어나면 안 된다', () => {
    expect(Math.abs(COOP_CELEBRATION_SIZE.width / COOP_CELEBRATION_SIZE.height - 171 / 176)).toBeLessThan(0.01);
  });
});
