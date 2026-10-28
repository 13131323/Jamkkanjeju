import { describe, expect, it } from 'vitest';
import { buildSafeAreaScript } from './safeAreaScript';

describe('buildSafeAreaScript', () => {
  it('insets를 px 단위 CSS 변수로 설정한다', () => {
    const script = buildSafeAreaScript({ top: 24, bottom: 48 });

    expect(script).toContain("setProperty('--safe-area-top', '24px')");
    expect(script).toContain("setProperty('--safe-area-bottom', '48px')");
  });

  it('소수점 inset을 정수로 반올림한다', () => {
    // 기기에 따라 insets가 소수로 들어온다. 그대로 쓰면 서브픽셀 렌더링으로 1px 틈이 생긴다.
    const script = buildSafeAreaScript({ top: 24.3, bottom: 47.6 });

    expect(script).toContain("'--safe-area-top', '24px'");
    expect(script).toContain("'--safe-area-bottom', '48px'");
  });

  it('injectJavaScript가 평가값을 직렬화하려다 죽지 않도록 true로 끝낸다', () => {
    expect(buildSafeAreaScript({ top: 0, bottom: 0 }).trimEnd()).toMatch(/true;$/);
  });
});
