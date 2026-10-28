import { describe, expect, it, vi } from 'vitest';

// 실물 react-native를 불러오면 Flow 문법 때문에 vitest가 파싱에 실패한다(coopRoles.test.ts와 같은 처리).
// 이 파일이 검증하는 함수는 순수 계산이라 Platform/StatusBar를 쓰지 않는다.
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  StatusBar: { currentHeight: 24 },
}));

import { CTA_BOTTOM_GAP, footerBottomPadding, MIN_BOTTOM_INSET } from './safeArea';

/**
 * 온보딩 푸터의 하단 여백.
 *
 * 루트 레이아웃(SafeAreaPadding)이 이미 `max(insets.bottom, MIN_BOTTOM_INSET)`을 먹이므로
 * 이 함수는 **그 위에 더 붙일 몫**을 돌려준다. 예전에는 차액만 돌려줘서 3버튼 내비게이션에서
 * 0이 되어 버튼이 바에 붙었다(사용자 확인) — 최소 간격을 보장하는 것이 이 테스트의 요점이다.
 */
describe('footerBottomPadding', () => {
  const ONBOARDING_DESIGN_BOTTOM = 28;
  const RESULT_DESIGN_BOTTOM = 32;

  // 실측: SM-G950N(1440x2960 @640dpi)의 mStable로 계산한 하단 inset이 48dp다
  it('3버튼 내비게이션(48)에서도 버튼이 바에 붙지 않는다', () => {
    expect(footerBottomPadding(48, ONBOARDING_DESIGN_BOTTOM)).toBe(CTA_BOTTOM_GAP);
  });

  it('제스처 내비게이션(24)에서도 같은 간격을 준다', () => {
    expect(footerBottomPadding(24, ONBOARDING_DESIGN_BOTTOM)).toBe(CTA_BOTTOM_GAP);
  });

  it('바가 없는 기기(0)에서도 같은 간격을 준다', () => {
    expect(footerBottomPadding(0, ONBOARDING_DESIGN_BOTTOM)).toBe(CTA_BOTTOM_GAP);
  });

  it('결과 화면의 디자인 여백(32)도 같은 규칙을 따른다', () => {
    expect(footerBottomPadding(48, RESULT_DESIGN_BOTTOM)).toBe(CTA_BOTTOM_GAP);
    expect(footerBottomPadding(0, RESULT_DESIGN_BOTTOM)).toBe(CTA_BOTTOM_GAP);
  });

  // 최소 간격이 상한이 되어서는 안 된다 — 디자인 여백이 큰 화면이 생기면 그대로 반영돼야 한다
  it('디자인 여백이 크면 차액이 최소 간격을 넘어 그대로 반영된다', () => {
    expect(footerBottomPadding(0, 100)).toBe(100 - MIN_BOTTOM_INSET);
    expect(footerBottomPadding(48, 100)).toBe(100 - 48);
  });

  it('어떤 입력에도 음수를 돌려주지 않는다', () => {
    expect(footerBottomPadding(200, 28)).toBeGreaterThanOrEqual(0);
    expect(footerBottomPadding(0, 0)).toBeGreaterThanOrEqual(0);
  });
});
