import { describe, expect, it } from 'vitest';
import { COMPOSITE_MAX_SCALE, resolveCompositeCaptureScale } from './compositeCaptureScale';
import { UPLOAD_MAX_LONG_EDGE_PX, resolveUploadCaptureSize } from './uploadCaptureSize';

/** 실기기에서 흔한 (dp 폭, dp 높이, 화면 배율) 조합 */
const DEVICES = [
  { name: '720x1280 / 배율 2', frameWidthDp: 360, frameHeightDp: 640, pixelRatio: 2 },
  { name: '1080x1920 / 배율 3', frameWidthDp: 360, frameHeightDp: 640, pixelRatio: 3 },
  { name: '1080x2400 / 배율 3', frameWidthDp: 360, frameHeightDp: 800, pixelRatio: 3 },
  { name: '1080x2340 / 배율 2.75', frameWidthDp: 393, frameHeightDp: 851, pixelRatio: 2.75 },
  { name: '1440x3120 / 배율 3.5', frameWidthDp: 412, frameHeightDp: 892, pixelRatio: 3.5 },
];

describe('resolveCompositeCaptureScale', () => {
  it('픽셀 긴 변이 한도를 넘지 않는 선에서만 키운다', () => {
    // 720x1280 기기: 긴 변 1280px → 2400/1280 = 1.875배까지 키울 수 있다
    expect(resolveCompositeCaptureScale({ frameWidthDp: 360, frameHeightDp: 640, pixelRatio: 2 })).toBeCloseTo(1.875, 5);
  });

  it('화면이 이미 한도에 닿아 있으면 1배로 둔다 (고정 3배가 만들던 23MP 비트맵을 없앤다)', () => {
    // 360x800dp / 배율 3 = 1080x2400px. 예전에는 여기서 3240x7200(23.3MP, 약 89MiB)를 떴다.
    expect(resolveCompositeCaptureScale({ frameWidthDp: 360, frameHeightDp: 800, pixelRatio: 3 })).toBe(1);
  });

  it('화면 픽셀이 한도보다 커도 1배 아래로 줄이지는 않는다', () => {
    // 1442x3122px. 한도(2400)보다 크지만 "본 것보다 흐린 사진"을 만들지는 않는다.
    expect(resolveCompositeCaptureScale({ frameWidthDp: 412, frameHeightDp: 892, pixelRatio: 3.5 })).toBe(1);
  });

  it('배율이 아주 낮은 기기에서도 상한을 넘기지 않는다', () => {
    // 320x480px(배율 1) → 2400/480 = 5배까지 가능하지만 상한이 3이다
    expect(resolveCompositeCaptureScale({ frameWidthDp: 320, frameHeightDp: 480, pixelRatio: 1 })).toBe(COMPOSITE_MAX_SCALE);
  });

  it('가로가 더 긴 프레임도 긴 변을 기준으로 본다', () => {
    expect(resolveCompositeCaptureScale({ frameWidthDp: 800, frameHeightDp: 360, pixelRatio: 3 })).toBe(1);
  });

  it('실측 전(0 이하)이면 1배를 준다', () => {
    expect(resolveCompositeCaptureScale({ frameWidthDp: 0, frameHeightDp: 800, pixelRatio: 3 })).toBe(1);
    expect(resolveCompositeCaptureScale({ frameWidthDp: 360, frameHeightDp: 0, pixelRatio: 3 })).toBe(1);
    expect(resolveCompositeCaptureScale({ frameWidthDp: 360, frameHeightDp: 800, pixelRatio: 0 })).toBe(1);
    expect(resolveCompositeCaptureScale({ frameWidthDp: 360, frameHeightDp: 800, pixelRatio: 3, maxLongEdgePx: 0 })).toBe(1);
    expect(resolveCompositeCaptureScale({ frameWidthDp: 360, frameHeightDp: 800, pixelRatio: 3, maxScale: 0 })).toBe(1);
  });

  it('한도와 배율 상한을 직접 지정할 수 있다', () => {
    expect(resolveCompositeCaptureScale({ frameWidthDp: 360, frameHeightDp: 800, pixelRatio: 1, maxLongEdgePx: 1600 })).toBe(2);
    expect(resolveCompositeCaptureScale({ frameWidthDp: 360, frameHeightDp: 800, pixelRatio: 1, maxLongEdgePx: 1600, maxScale: 1.5 })).toBe(1.5);
  });

  /**
   * 이 버그의 핵심. 합성 비트맵은 `dp x 캡처 배율 x 화면 배율` 픽셀이고,
   * 그 크기가 곧 ARGB_8888 비트맵 크기(픽셀 x 4바이트)다.
   * 고정 3배는 화면 픽셀 면적의 9배를 만들어 흔한 기기에서 약 89MiB가 됐다.
   */
  it('어떤 기기에서도 합성 비트맵의 긴 변이 "한도와 화면 픽셀 중 큰 값"을 넘지 않는다', () => {
    for (const device of DEVICES) {
      const scale = resolveCompositeCaptureScale(device);
      const screenLongEdgePx = Math.max(device.frameWidthDp, device.frameHeightDp) * device.pixelRatio;
      const captureLongEdgePx = screenLongEdgePx * scale;

      expect(scale).toBeGreaterThanOrEqual(1);
      expect(scale).toBeLessThanOrEqual(COMPOSITE_MAX_SCALE);
      expect(captureLongEdgePx).toBeLessThanOrEqual(Math.max(UPLOAD_MAX_LONG_EDGE_PX, screenLongEdgePx) + 1e-6);
    }
  });

  it('합성 비트맵이 예전(고정 3배)보다 항상 작거나 같다', () => {
    for (const device of DEVICES) {
      expect(resolveCompositeCaptureScale(device)).toBeLessThanOrEqual(3);
    }
  });

  /**
   * 배율이 한도를 지키면 업로드용 축소 캡처가 필요 없어진다 — 셔터 한 번에 23MP 캡처를
   * 두 번 뜨던 것이 한 번으로 줄고, "사진을 서버에 올리지 못했어요"만 남기던 실패 지점도 사라진다.
   */
  it('화면 픽셀이 한도 안인 기기에서는 업로드용 추가 캡처가 필요 없다', () => {
    for (const device of DEVICES) {
      const screenLongEdgePx = Math.max(device.frameWidthDp, device.frameHeightDp) * device.pixelRatio;
      const scale = resolveCompositeCaptureScale(device);

      const uploadSize = resolveUploadCaptureSize({
        viewWidthDp: device.frameWidthDp * scale,
        viewHeightDp: device.frameHeightDp * scale,
        pixelRatio: device.pixelRatio,
        optionUnit: 'px',
      });

      if (screenLongEdgePx <= UPLOAD_MAX_LONG_EDGE_PX) {
        expect(uploadSize).toBeNull();
      } else {
        // 화면 자체가 한도보다 큰 기기에서만 축소본을 한 번 더 뜬다
        expect(uploadSize).not.toBeNull();
        expect(Math.max(uploadSize!.width, uploadSize!.height)).toBeLessThanOrEqual(UPLOAD_MAX_LONG_EDGE_PX);
      }
    }
  });
});
