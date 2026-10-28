/**
 * 오프스크린 합성 뷰를 화면(dp) 대비 몇 배 크기로 만들지 정한다.
 *
 * ## 왜 고정 배율(3)이면 안 되는가
 *
 * RN의 style 값은 dp이고, Android의 view-shot은 **뷰의 픽셀 크기**로 비트맵을 뜬다
 * (`ViewShot.java`의 `view.getWidth()`/`getHeight()` — RN Android의 레이아웃 값은 px다).
 * 즉 합성 뷰를 `frameSize(dp) * 3`으로 만들면 실제 비트맵은
 *
 *   `화면 픽셀 수 x 3` (변마다) = **화면 픽셀 면적의 9배**
 *
 * 가 된다. 360x800dp / 배율 3인 흔한 기기(= 화면 1080x2400px)에서 3240x7200 = 23.3MP,
 * ARGB_8888 비트맵으로 **약 89MiB**다. 이걸 셔터 한 번에 두 번 뜬다(갤러리용 + 업로드용).
 *
 * view-shot은 `width/height` 옵션을 줘도 **원본 크기 비트맵을 먼저 뜬 뒤**
 * `Bitmap.createScaledBitmap`으로 줄인다. 그래서 축소 옵션으로는 최대 메모리가 줄지 않는다 —
 * 줄일 수 있는 건 **뷰 자체의 크기**뿐이다. 실패하면 네이티브가 `Throwable`을 잡아
 * `E_UNABLE_TO_SNAPSHOT`으로 promise를 reject하므로(크래시가 아니라) 화면에는
 * "사진을 서버에 올리지 못했어요" / "사진을 찍지 못했어요" 토스트만 남는다.
 *
 * ## 그러면 1배면 충분한가
 *
 * "1배로 저장하면 흐려진다"는 예전 주석은 dp와 px를 섞어 읽은 것이다. 1배는 **화면 해상도 그대로**다
 * (360dp x 배율 3 = 1080px). 흐려지는 건 화면 배율이 낮은 기기(720x1280 등)뿐이므로,
 * 배율은 "픽셀 긴 변이 한도에 닿을 때까지만" 키우면 된다.
 *
 * ## 규칙
 *
 * - 하한 1배 — 저장 사진이 화면 해상도보다 낮아지는 일은 만들지 않는다.
 * - 상한 {@link COMPOSITE_MAX_SCALE}배 — 배율이 아주 낮은 기기에서도 무한정 키우지 않는다.
 * - 그 사이에서 픽셀 긴 변이 `maxLongEdgePx`를 넘지 않는 가장 큰 배율.
 *
 * 기본 한도는 업로드본과 같은 {@link UPLOAD_MAX_LONG_EDGE_PX}다. 한도 안에 들어오면
 * 업로드용 캡처를 따로 뜰 필요가 없어져(=`resolveUploadCaptureSize`가 null) 셔터당 캡처가
 * 한 번으로 줄고, 그만큼 실패 지점도 하나 사라진다.
 */
import { UPLOAD_MAX_LONG_EDGE_PX } from './uploadCaptureSize';

/**
 * 합성 뷰를 화면 대비 키울 수 있는 최대 배율.
 *
 * 저해상도 기기(배율 1~2)에서 갤러리 사진이 화면 해상도에 묶이지 않게 해 주는 값이다.
 * 예전 고정값과 같은 3으로 두되, 여기서는 "상한"일 뿐 실제 배율은 픽셀 한도가 정한다.
 */
export const COMPOSITE_MAX_SCALE = 3;

interface CompositeCaptureScaleInput {
  /** 카메라가 실제로 채운 영역의 dp 폭 (onLayout 실측값) */
  frameWidthDp: number;
  /** 카메라가 실제로 채운 영역의 dp 높이 (onLayout 실측값) */
  frameHeightDp: number;
  /** `PixelRatio.get()`. dp를 실제 픽셀 수로 환산하는 배율 */
  pixelRatio: number;
  /** 합성 비트맵의 픽셀 긴 변 상한 */
  maxLongEdgePx?: number;
  /** 배율 상한 */
  maxScale?: number;
}

/**
 * 오프스크린 합성 뷰에 쓸 dp 배율을 만든다. 항상 1 이상 {@link COMPOSITE_MAX_SCALE} 이하다.
 *
 * 아직 실측 전(0 이하)이면 1을 준다 — 화면과 같은 크기가 가장 안전한 기본값이다.
 */
export function resolveCompositeCaptureScale({
  frameWidthDp,
  frameHeightDp,
  pixelRatio,
  maxLongEdgePx = UPLOAD_MAX_LONG_EDGE_PX,
  maxScale = COMPOSITE_MAX_SCALE,
}: CompositeCaptureScaleInput): number {
  if (frameWidthDp <= 0 || frameHeightDp <= 0 || pixelRatio <= 0 || maxLongEdgePx <= 0 || maxScale < 1) return 1;

  const screenLongEdgePx = Math.max(frameWidthDp, frameHeightDp) * pixelRatio;
  // 화면 자체가 이미 한도보다 크면 더 키우지 않는다(=1배). 한도 아래로 줄이지는 않는다 —
  // 그건 "본 것보다 흐린 사진"을 만드는 일이고, 업로드본은 어차피 따로 축소해서 뜬다.
  const allowedScale = maxLongEdgePx / screenLongEdgePx;

  return Math.min(maxScale, Math.max(1, allowedScale));
}
