import { describe, expect, it } from 'vitest';

import { BUTTON_COMPACT_PADDING_HORIZONTAL, BUTTON_SIZE_STYLES } from './styles';

/**
 * 보물찾기 완료 화면(MissionAlreadyCompleteLayout)의 하단 CTA 두 개는 폭을 반씩 나눠 갖는다.
 * 디자인 기준 360dp에서 한 칸이 얼마나 되는지 — ctaWrapper의 좌우 16과 가운데 gap 8을 뺀 값.
 */
const DESIGN_SCREEN_WIDTH = 360;
const CTA_ROW_PADDING_HORIZONTAL = 16;
const CTA_GAP = 8;
const CTA_BUTTON_WIDTH = (DESIGN_SCREEN_WIDTH - CTA_ROW_PADDING_HORIZONTAL * 2 - CTA_GAP) / 2;

/**
 * "보물이랑 사진찍기"를 Pretendard-Bold 16px로 그렸을 때의 폭(dp).
 *
 * assets/fonts/Pretendard-Bold.ttf의 hmtx/cmap에서 글자별 advance를 더해 잰 값이다
 * (unitsPerEm 2048 기준 14632 → 16px에서 114.31dp). 올림해서 안전한 정수로 둔다.
 */
const LONGEST_CTA_LABEL_WIDTH = 115;

describe('2분할 CTA 라벨 자리', () => {
  it('md 기본 여백으로는 "보물이랑 사진찍기"가 들어가지 않는다', () => {
    const { paddingHorizontal } = BUTTON_SIZE_STYLES.md;

    expect(CTA_BUTTON_WIDTH - Number(paddingHorizontal) * 2).toBeLessThan(LONGEST_CTA_LABEL_WIDTH);
  });

  it('compact 여백이면 한 줄에 들어간다', () => {
    expect(CTA_BUTTON_WIDTH - BUTTON_COMPACT_PADDING_HORIZONTAL * 2).toBeGreaterThanOrEqual(LONGEST_CTA_LABEL_WIDTH);
  });

  it('compact는 md 기본값보다 줄이기만 한다 — 다른 화면이 쓰는 기본 여백은 그대로다', () => {
    expect(BUTTON_SIZE_STYLES.md.paddingHorizontal).toBe(24);
    expect(BUTTON_COMPACT_PADDING_HORIZONTAL).toBeLessThan(24);
  });
});
