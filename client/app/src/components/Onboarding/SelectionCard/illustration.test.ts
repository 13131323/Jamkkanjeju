import { describe, expect, it } from 'vitest';
import {
  REVERSE_ILLUSTRATION_ASPECT,
  REVERSE_ILLUSTRATION_HEIGHT_RATIO,
  reverseIllustrationSize,
} from './illustration';

/** 디자인(Penpot Int3Screen) 기준 카드 높이 */
const DESIGN_CARD_HEIGHT = 118;

describe('reverseIllustrationSize', () => {
  it('측정 전(0)에는 디자인 기본 크기를 준다', () => {
    expect(reverseIllustrationSize(0)).toEqual({ width: 152, height: 91 });
  });

  it('음수 같은 비정상 값에도 기본 크기로 버틴다', () => {
    expect(reverseIllustrationSize(-10)).toEqual({ width: 152, height: 91 });
  });

  it('디자인 카드 높이에서는 디자인 일러스트 크기가 나온다', () => {
    const { width, height } = reverseIllustrationSize(DESIGN_CARD_HEIGHT);

    expect(height).toBeCloseTo(91, 5);
    expect(width).toBeCloseTo(152, 5);
  });

  it('카드가 커지면 같은 비율로 커진다', () => {
    const base = reverseIllustrationSize(DESIGN_CARD_HEIGHT);
    const grown = reverseIllustrationSize(DESIGN_CARD_HEIGHT * 1.5);

    expect(grown.height).toBeCloseTo(base.height * 1.5, 5);
    expect(grown.width).toBeCloseTo(base.width * 1.5, 5);
  });

  it('어떤 높이에서도 에셋 가로세로 비율을 유지한다 — 재익스포트로 픽셀이 바뀌어도 무관하다', () => {
    for (const cardHeight of [92, 118, 160, 240]) {
      const { width, height } = reverseIllustrationSize(cardHeight);
      expect(width / height).toBeCloseTo(REVERSE_ILLUSTRATION_ASPECT, 10);
    }
  });

  it('일러스트는 항상 카드보다 낮아 잘리지 않는다', () => {
    expect(REVERSE_ILLUSTRATION_HEIGHT_RATIO).toBeLessThan(1);

    for (const cardHeight of [92, 118, 160, 240]) {
      expect(reverseIllustrationSize(cardHeight).height).toBeLessThan(cardHeight);
    }
  });
});
