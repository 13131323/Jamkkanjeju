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
    expect(metricsAt(1000)).toEqual({ celebration: 178, suggestionGap: 40 });
    expect(metricsAt(1400)).toEqual({ celebration: 178, suggestionGap: 40 });
  });

  it('여유가 있으면 간격이 먼저 깎이고, 표준을 밑돌면 간격 28을 먼저 확보한다', () => {
    // 여유가 충분: 이미지 상한 + 간격도 여유
    expect(metricsAt(720)).toEqual({ celebration: 178, suggestionGap: 40 });
    // 줄어들기 시작 — 이미지가 표준(164)을 넘겨 받을 수 있는 동안은 간격이 먼저 깎인다
    expect(metricsAt(690)).toEqual({ celebration: 178, suggestionGap: 23 });
    // 예산이 표준(164+28)을 밑도는 순간 순서가 뒤집힌다. 캐릭터가 작아지는 화면일수록
    // 문구 위가 트여야 한다는 지시라, 간격 28을 먼저 떼고 남은 것을 이미지가 받는다
    expect(metricsAt(670)).toEqual({ celebration: 153, suggestionGap: 28 });
    expect(metricsAt(660)).toEqual({ celebration: 143, suggestionGap: 28 });
    // 이미지가 하한(120)에 닿으면 그때부터 간격이 최소치까지 깎인다
    expect(metricsAt(620)).toEqual({ celebration: 120, suggestionGap: 12 });
    // 하한 아래로는 둘 다 더 줄지 않는다 — 나머지는 ScrollView가 처리한다
    expect(metricsAt(400)).toEqual({ celebration: 120, suggestionGap: 12 });
  });

  it('보상 행이 줄면 그만큼 이미지와 간격이 커진다 — 행 수에 따라 여백이 달라지던 문제', () => {
    // 한 행이 44라 행이 줄어든 만큼 예산이 늘고, 이미지 → 간격 순으로 채워진다.
    // 600은 네 경우가 상하한에 뭉치지 않고 단계적으로 보이는 높이다.
    const usableHeight = 600;

    expect(metricsAt(usableHeight, 3)).toEqual({ celebration: 120, suggestionGap: 12 });
    // 아직 표준(164+28)에 못 미치는 예산이라 간격 28을 먼저 확보한다
    expect(metricsAt(usableHeight, 2)).toEqual({ celebration: 127, suggestionGap: 28 });
    // 이미지가 상한에 닿은 뒤부터 남는 몫이 간격으로 간다
    expect(metricsAt(usableHeight, 1)).toEqual({ celebration: 178, suggestionGap: 21 });
    // 행이 0이면 카드 chrome(43)까지 사라져 간격도 상한에 닿는다
    expect(metricsAt(usableHeight, 0)).toEqual({ celebration: 178, suggestionGap: 40 });
  });

  it('둘의 합이 남는 높이를 넘지 않는다 — 동시에 커져서 오히려 넘치면 안 된다', () => {
    for (let height = 560; height <= 1000; height += 10) {
      for (const rows of [0, 1, 2, 3]) {
        const { celebration, suggestionGap } = metricsAt(height, rows);
        const budget = height - fixedContentHeight(rows);
        // 하한(120 + 12)에 걸린 작은 기기만 예산을 넘길 수 있다 — 그건 ScrollView가 받는다
        const isClampedToMinimum = celebration === 120 && suggestionGap === 12;

        if (!isClampedToMinimum) {
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

  it('측정 전이거나 이상값이면 기존 값(배율 1, 디자인 간격 28)을 쓴다 — 이미지가 사라지면 안 된다', () => {
    for (const usableHeight of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolveCompleteLayout({ usableHeight, resultRowCount: 3 })).toEqual({ celebrationScale: 1, suggestionGap: 28 });
    }
  });

  it('어떤 높이·행 수 조합에서도 상하한을 벗어나지 않는다', () => {
    for (let height = 200; height <= 1400; height += 10) {
      for (const rows of [0, 1, 2, 3]) {
        const { celebration, suggestionGap } = metricsAt(height, rows);

        expect(celebration).toBeGreaterThanOrEqual(120);
        expect(celebration).toBeLessThanOrEqual(178);
        expect(suggestionGap).toBeGreaterThanOrEqual(12);
        expect(suggestionGap).toBeLessThanOrEqual(40);
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
