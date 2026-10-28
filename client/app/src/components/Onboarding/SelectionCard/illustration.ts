/**
 * step3(horizontal-reverse) 카드의 일러스트 크기.
 *
 * 카드는 기기 높이에 맞춰 늘어나는데 일러스트가 고정 크기면 우하단에 붙은 채
 * 텍스트와의 간격만 벌어진다. 카드 높이에 비례해 함께 키워 디자인 비율을 유지한다.
 *
 * 값은 전부 dp이고 Penpot 디자인 값에서만 유도한다 — PNG 픽셀 크기를 참조하지 않는다.
 * 그래서 에셋을 3배로 재익스포트해도 레이아웃이 그대로다.
 */

/** 디자인 Int3Screen: 카드 328x118, 일러스트는 152x91(197x118의 0.77배) */
const DESIGN_CARD_HEIGHT = 118;
const DESIGN_ILLUSTRATION_WIDTH = 152;
const DESIGN_ILLUSTRATION_HEIGHT = 91;

/** 카드 높이 대비 일러스트 높이. 1보다 작아야 일러스트가 카드 안에 들어온다 */
export const REVERSE_ILLUSTRATION_HEIGHT_RATIO = DESIGN_ILLUSTRATION_HEIGHT / DESIGN_CARD_HEIGHT;

/** 일러스트 가로/세로. step3 에셋 세 개가 모두 같은 비율이다 */
export const REVERSE_ILLUSTRATION_ASPECT = DESIGN_ILLUSTRATION_WIDTH / DESIGN_ILLUSTRATION_HEIGHT;

export interface IllustrationSize {
  width: number;
  height: number;
}

/**
 * @param cardHeight onLayout으로 잰 카드 높이. 첫 렌더에는 아직 0이다.
 */
export function reverseIllustrationSize(cardHeight: number): IllustrationSize {
  if (cardHeight <= 0) {
    // 측정 전 한 프레임은 디자인 기본값으로 그린다 — 빈 자리가 보이지 않게.
    return { width: DESIGN_ILLUSTRATION_WIDTH, height: DESIGN_ILLUSTRATION_HEIGHT };
  }

  const height = cardHeight * REVERSE_ILLUSTRATION_HEIGHT_RATIO;
  return { width: height * REVERSE_ILLUSTRATION_ASPECT, height };
}
