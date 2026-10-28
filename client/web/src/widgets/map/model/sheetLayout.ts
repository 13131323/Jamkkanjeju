/**
 * 지도 바텀시트의 **아래** 여백.
 *
 * 앱 전체 기준은 20(app/src/styles/safeArea.ts의 CTA_BOTTOM_GAP)이지만 지도 시트만 12를 쓴다.
 * 시트는 화면 맨 아래에 붙는데, 앱 루트 레이아웃이 WebView 아래에 `max(insets.bottom, 16)`을
 * 이미 깔아 두기 때문이다(app/app/_layout.tsx의 SafeAreaPadding). 20을 쓰면 실제로 보이는
 * 아래 여백이 36 이상이 되어, 핸들 위아래를 합친 위쪽 28~32보다 넓어진다 — 12로 두면 28에 맞는다.
 *
 * 앱 WebView에서 `--safe-area-bottom`은 항상 0이라(WEBVIEW_BOTTOM_INSET) 이 값이 그대로 쓰이고,
 * 브라우저에서 볼 때만 env()로 들어온 실제 inset이 더 크면 그쪽을 택한다.
 */
export const SHEET_BOTTOM_PADDING = 'max(12px, var(--safe-area-bottom))';
