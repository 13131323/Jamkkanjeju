/**
 * 업로드용 합성 캡처의 크기를 정한다.
 *
 * 왜 갤러리 사진을 그대로 올리지 않는가:
 * 서버는 사진을 **최대 10MB**까지만 받는다(app/common/images.py, 초과 시 400 INVALID_REQUEST).
 * 합성 사진의 픽셀 수가 크면 그 한도를 쉽게 넘는다 —
 * 오프스크린 합성 뷰는 `frameSize(dp) * 캡처 배율` 크기이고, Android의 view-shot은
 * **뷰의 픽셀 크기**(= dp x 화면 배율)로 비트맵을 뜬다. 배율이 고정 3이던 시절에는
 * 360dp 폭 / 배율 3인 흔한 기기에서 3240 x 7200 = 23.3MP가 됐고, quality 0.92 JPEG로는
 *
 *   - 부드러운 실사 사진 수준  → 약  7.2MB
 *   - 카메라 사진을 업스케일한 정도 → 약 13.5MB  (한도 초과)
 *   - 고주파(노이즈) 최악        → 약 28.8MB  (한도 초과)
 *
 * 정도가 나온다(PIL로 같은 해상도/품질을 재현해 측정). 즉 **실측 없이도 초과가 확실한 구간**이 있다.
 *
 * 왜 "재서 넘으면 거절"이 아니라 "해상도를 묶는" 쪽인가:
 * 1. 파일 크기를 싸고 안전하게 잴 방법이 없다. `expo-file-system`은 package.json에 없고(새 의존성
 *    추가 금지), `expo-media-library`의 Asset은 width/height만 주고 바이트 크기를 주지 않는다.
 *    `fetch(uri).blob().size`는 RN Android의 BlobModule UriHandler가 file:// 도 받아 주긴 하지만
 *    (ReactAndroid/.../blob/BlobModule.kt) 파일 전체를 네이티브 메모리로 읽어 들인다 —
 *    하필 "너무 큰 파일"일 때 가장 비싼 방식이고, 업로드 경로(스트리밍)보다 메모리를 더 쓴다.
 * 2. 품질만 낮춰서는 해결되지 않는다. 같은 23.3MP에서 quality를 0.70까지 내려도 최악값은 16MB다.
 *    한도를 넘기는 원인은 품질이 아니라 화소 수다.
 * 3. 반면 긴 변을 묶으면 상한이 **계산으로 보장**된다. 2400px 긴 변(1080x2400 = 2.6MP)에서
 *    최악(노이즈) JPEG가 3.2MB로, 10MB 대비 3배 여유가 남는다. 측정도, 실패 분기도 필요 없다.
 *
 * 지금은 캡처 배율(compositeCaptureScale.ts)이 합성 뷰의 픽셀 긴 변을 여기와 같은 한도로 묶는다.
 * 그래서 대부분의 기기에서 이 함수는 null을 주고(= 축소 불필요) 합성본이 그대로 업로드된다.
 * 화면 픽셀 자체가 한도보다 큰 기기에서만 업로드용 축소본을 한 번 더 뜬다.
 */

/**
 * 업로드용 합성 사진의 긴 변 최대 픽셀.
 *
 * 2400px = 흔한 기기의 화면 세로 픽셀 수 정도라 서버에 저장된 사진을 전체 화면으로 다시 보여줘도
 * 부족하지 않고, 10MB 한도에는 3배 여유가 남는다(위 측정치 참고).
 */
export const UPLOAD_MAX_LONG_EDGE_PX = 2400;

interface UploadCaptureSizeInput {
  /** 오프스크린 합성 뷰의 dp 크기 = frameSize.width * 캡처 배율 */
  viewWidthDp: number;
  /** 오프스크린 합성 뷰의 dp 크기 = frameSize.height * CAPTURE_SCALE */
  viewHeightDp: number;
  /** `PixelRatio.get()`. 뷰의 dp를 실제 캡처 픽셀 수로 환산하는 배율 */
  pixelRatio: number;
  /**
   * captureRef의 `width`/`height` 옵션이 어떤 단위로 해석되는지. 플랫폼마다 다르다:
   * - Android(`'px'`): 뜬 비트맵을 `Bitmap.createScaledBitmap(bitmap, width, height, ...)`에
   *   그대로 넘긴다 → **픽셀**.
   * - iOS(`'dp'`): `UIGraphicsImageRenderer initWithSize:size` + `format.scale = 0`(기기 배율)이라
   *   최종 픽셀 수가 `size x 기기 배율`이 된다 → **포인트(dp)**.
   * (양쪽 네이티브 소스를 직접 읽고 확인. iOS는 실기기 검증 못 함 — 이 프로젝트 검증 플랫폼은 Android)
   */
  optionUnit: 'px' | 'dp';
  maxLongEdgePx?: number;
}

/**
 * 업로드용 캡처에 넘길 `width`/`height`를 만든다.
 *
 * 축소가 필요 없으면 `null`을 준다 — 그때는 옵션을 아예 넘기지 않아야 한다.
 * 값을 넘기면 view-shot이 `createScaledBitmap`을 타면서 원본보다 **키우는** 일이 생기고,
 * 화질은 그대로인데 바이트만 늘어난다.
 */
export function resolveUploadCaptureSize({ viewWidthDp, viewHeightDp, pixelRatio, optionUnit, maxLongEdgePx = UPLOAD_MAX_LONG_EDGE_PX }: UploadCaptureSizeInput): {
  width: number;
  height: number;
} | null {
  if (viewWidthDp <= 0 || viewHeightDp <= 0 || pixelRatio <= 0 || maxLongEdgePx <= 0) return null;

  const naturalWidthPx = viewWidthDp * pixelRatio;
  const naturalHeightPx = viewHeightDp * pixelRatio;
  const longEdgePx = Math.max(naturalWidthPx, naturalHeightPx);

  // 이미 한도 안이면 원본 그대로 뜬다
  if (longEdgePx <= maxLongEdgePx) return null;

  const scale = maxLongEdgePx / longEdgePx;
  // 단위 환산: iOS는 포인트를 받으므로 픽셀 목표치를 기기 배율로 되돌린다
  const unitDivisor = optionUnit === 'px' ? 1 : pixelRatio;

  // view-shot은 width/height를 양의 정수로만 받는다(lib/index.js validateOptions, 네이티브는 getInt).
  // 0으로 내려가면 옵션이 버려지므로 최소 1을 보장한다.
  return {
    width: Math.max(1, Math.round((naturalWidthPx * scale) / unitDivisor)),
    height: Math.max(1, Math.round((naturalHeightPx * scale) / unitDivisor)),
  };
}
