import { describe, expect, it } from 'vitest';
import { UPLOAD_MAX_LONG_EDGE_PX, resolveUploadCaptureSize } from './uploadCaptureSize';

/** 캡처 배율이 고정 3이던 시절의 조합(360x800dp 화면 → 합성 뷰 1080x2400dp). 축소 계산 자체는 그대로 검증한다. */
const COMMON_VIEW = { viewWidthDp: 1080, viewHeightDp: 2400 };

describe('resolveUploadCaptureSize', () => {
  it('배율 3 기기(실제 3240x7200px)를 긴 변 2400px으로 줄인다', () => {
    const size = resolveUploadCaptureSize({ ...COMMON_VIEW, pixelRatio: 3, optionUnit: 'px' });

    // 3240x7200 -> scale 2400/7200 = 1/3 -> 1080x2400
    expect(size).toEqual({ width: 1080, height: 2400 });
  });

  it('줄인 결과의 가로세로 비율이 원본과 같다', () => {
    const size = resolveUploadCaptureSize({ ...COMMON_VIEW, pixelRatio: 3, optionUnit: 'px' });

    expect(size).not.toBeNull();
    expect(size!.width / size!.height).toBeCloseTo(COMMON_VIEW.viewWidthDp / COMMON_VIEW.viewHeightDp, 5);
  });

  it('긴 변이 항상 한도 이하가 된다 (10MB 한도를 계산으로 보장하는 근거)', () => {
    // 화면 dp와 배율을 넓게 훑어도 상한이 깨지지 않아야 한다
    for (const widthDp of [320, 360, 393, 412, 450]) {
      for (const heightDp of [640, 780, 800, 873, 1000]) {
        for (const pixelRatio of [1, 1.5, 2, 2.75, 3, 3.5, 4]) {
          const size = resolveUploadCaptureSize({
            viewWidthDp: widthDp * 3,
            viewHeightDp: heightDp * 3,
            pixelRatio,
            optionUnit: 'px',
          });
          if (size === null) {
            // null은 "원본이 이미 한도 안"이라는 뜻이다
            expect(Math.max(widthDp, heightDp) * 3 * pixelRatio).toBeLessThanOrEqual(UPLOAD_MAX_LONG_EDGE_PX);
            continue;
          }
          expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(UPLOAD_MAX_LONG_EDGE_PX);
        }
      }
    }
  });

  it('이미 한도 안이면 null을 준다 (옵션을 넘기지 않아 원본을 그대로 뜨게 한다)', () => {
    // 1080x1920dp, 배율 1 → 긴 변 1920px < 2400px. 값을 넘기면 오히려 확대가 된다.
    expect(resolveUploadCaptureSize({ viewWidthDp: 1080, viewHeightDp: 1920, pixelRatio: 1, optionUnit: 'px' })).toBeNull();
  });

  it('한도와 정확히 같은 크기도 그대로 둔다', () => {
    expect(resolveUploadCaptureSize({ viewWidthDp: 1080, viewHeightDp: 2400, pixelRatio: 1, optionUnit: 'px' })).toBeNull();
  });

  it("iOS('dp')는 포인트를 받으므로 기기 배율로 나눈 값을 준다", () => {
    // 목표 픽셀은 Android와 같은 1080x2400px이지만, iOS는 size x 기기 배율로 렌더하므로
    // 배율 3에서는 360x800pt를 넘겨야 같은 픽셀 수가 나온다.
    expect(resolveUploadCaptureSize({ ...COMMON_VIEW, pixelRatio: 3, optionUnit: 'dp' })).toEqual({ width: 360, height: 800 });
  });

  it('정수만 준다 (view-shot은 width/height를 양의 정수로만 받는다)', () => {
    const size = resolveUploadCaptureSize({ viewWidthDp: 1179, viewHeightDp: 2556, pixelRatio: 2.75, optionUnit: 'px' });

    expect(size).not.toBeNull();
    expect(Number.isInteger(size!.width)).toBe(true);
    expect(Number.isInteger(size!.height)).toBe(true);
    expect(size!.width).toBeGreaterThan(0);
    expect(size!.height).toBeGreaterThan(0);
  });

  it('가로가 더 긴 프레임도 긴 변을 기준으로 줄인다', () => {
    const size = resolveUploadCaptureSize({ viewWidthDp: 2400, viewHeightDp: 1080, pixelRatio: 3, optionUnit: 'px' });

    expect(size).toEqual({ width: 2400, height: 1080 });
  });

  it('maxLongEdgePx를 직접 지정할 수 있다', () => {
    expect(resolveUploadCaptureSize({ ...COMMON_VIEW, pixelRatio: 3, optionUnit: 'px', maxLongEdgePx: 1200 })).toEqual({ width: 540, height: 1200 });
  });

  it('크기나 배율이 0 이하면 null을 준다 (측정 전 상태)', () => {
    expect(resolveUploadCaptureSize({ viewWidthDp: 0, viewHeightDp: 2400, pixelRatio: 3, optionUnit: 'px' })).toBeNull();
    expect(resolveUploadCaptureSize({ viewWidthDp: 1080, viewHeightDp: 0, pixelRatio: 3, optionUnit: 'px' })).toBeNull();
    expect(resolveUploadCaptureSize({ ...COMMON_VIEW, pixelRatio: 0, optionUnit: 'px' })).toBeNull();
    expect(resolveUploadCaptureSize({ ...COMMON_VIEW, pixelRatio: 3, optionUnit: 'px', maxLongEdgePx: 0 })).toBeNull();
  });
});
