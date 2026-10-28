import { Platform, StatusBar } from 'react-native';

/**
 * 네비게이션바가 없는 기기(insets.bottom === 0)에서 확보할 최소 하단 여백.
 *
 * 이 프로젝트의 Penpot 디자인은 iOS 기준으로 그려져 있어서 화면 하단에 홈 인디케이터
 * 영역(33)이 이미 포함돼 있다. 그래서 디자인의 하단 여백을 그대로 쓰지 않고
 * 실제 inset으로 대체하되, 시스템 바가 없는 기기에서는 이 값으로 받친다.
 *
 * 루트 레이아웃(SafeAreaPadding)과 FullBleed가 같은 값을 써야 상쇄가 정확해지므로
 * 여기 한 곳에서만 정의한다.
 */
export const MIN_BOTTOM_INSET = 16;

/**
 * 하단 CTA 버튼 **아래** 여백.
 *
 * 화면마다 `max(insets.bottom, 16)`을 각자 적어 두는 바람에 값이 조금씩 갈라져 있었다.
 * 기준을 도감의 "함께 사진 찍기"(web, `max(20px, safe-area-bottom)`)로 잡고 앱 전체를 맞춘다
 * (사용자 지시) — 같은 자리에 같은 모양으로 놓이는 버튼이 화면마다 4px씩 다르면 그게 곧 어긋남이다.
 *
 * 시스템 바가 있으면 그 높이가 더 크므로 `max`로 받는다. 촬영 화면의 셔터 패널처럼 버튼 CTA가
 * 아닌 자리도 이 값을 쓴다(사용자 지시) — 화면 아래 여백이 자리마다 다르면 그게 곧 어긋남이다.
 */
export const CTA_BOTTOM_GAP = 20;

/**
 * FullBleed 안에 있는 하단 CTA의 paddingBottom.
 *
 * 여기서 `max(insets.bottom, CTA_BOTTOM_GAP)`을 쓰면 **아래 여백이 통째로 사라진다**(사용자 확인).
 * FullBleed가 이미 `max(insets.bottom, MIN_BOTTOM_INSET)`만큼 화면을 아래로 늘려 놓았기 때문에,
 * 그 값과 같거나 작은 padding은 네비게이션바 자리를 되돌리는 데 다 쓰이고 버튼 아래에는 0이 남는다.
 * 실기기(네비게이션바 55dp)에서 버튼 밑변이 바에 딱 붙어 있던 게 이 계산 때문이다.
 *
 * 그래서 **더하기**로 바꾼다: 바를 되돌리는 몫과 눈에 보이는 여백을 따로 준다.
 * 결과는 기기와 무관하게 "바 위로 CTA_BOTTOM_GAP만큼" — 도감의 "함께 사진 찍기"(web)와 같은 모양이다.
 *
 * FullBleed 밖(루트 padding을 그대로 받는 화면)에서는 이 함수를 쓰면 안 된다. 그쪽은 바가 이미
 * 비켜져 있으므로 `CTA_BOTTOM_GAP`만 주면 된다.
 */
export function ctaBottomPadding(insetBottom: number) {
  return Math.max(insetBottom, MIN_BOTTOM_INSET) + CTA_BOTTOM_GAP;
}

/**
 * 디자인 푸터의 하단 여백을 시스템 바가 대체하도록 보정한다.
 *
 * 온보딩 보드(Int1~3 / IntResultScreen)는 Android 기준으로 그려져 있어서 버튼 아래에
 * 여백 28~32와 네비게이션바 48이 나란히 들어가 있다. 둘을 그대로 더하면 실기기에서
 * 버튼 아래만 76이 비고, 그만큼 본문이 밀려 작은 화면에서 스크롤이 생긴다.
 *
 * 그래서 "버튼 아래 총 여백 = max(시스템 바, 디자인 여백)"으로 잡고, 루트 레이아웃이 이미
 * `max(insets.bottom, MIN_BOTTOM_INSET)`을 먹이고 있으므로 그 차액만 돌려준다.
 *
 * **차액이 0이 되는 경우를 CTA_BOTTOM_GAP으로 받친다.** 3버튼 내비게이션(48)은 디자인 여백(28)보다
 * 두꺼워서 차액이 0이 되는데, 그러면 버튼이 내비게이션바에 그대로 붙는다(사용자 확인).
 * 바는 시스템 영역이라 여백처럼 읽히지 않는다 — `ctaBottomPadding`이 같은 이유로 이미
 * "바 위로 CTA_BOTTOM_GAP만큼"으로 정리돼 있고, 여기도 같은 규칙을 따른다.
 *
 * 실측(SM-G950N, 1440x2960 @640dpi): `mStable=[0,96][1440,2768]` → 하단 inset 48dp.
 *   - 3버튼(48): max(20, 48-48) → 푸터 20
 *   - 제스처(24): max(20, 28-24) → 푸터 20
 *   - 바 없음(0):  max(20, 28-16) → 푸터 20
 *
 * 결과가 어느 기기에서나 20인 이유는 디자인 여백(28~32)이 루트가 먹이는 값과 가깝기 때문이다.
 * 디자인 여백이 훨씬 큰 화면이 생기면 그때는 차액이 20을 넘어 그대로 반영된다.
 */
export function footerBottomPadding(insetBottom: number, designBottom: number) {
  const rootApplied = Math.max(insetBottom, MIN_BOTTOM_INSET);
  const desired = Math.max(insetBottom, designBottom);

  return Math.max(CTA_BOTTOM_GAP, desired - rootApplied);
}

/**
 * WebView(web)에 넘길 하단 안전영역 값.
 *
 * /home은 루트 레이아웃(SafeAreaPadding)이 네이티브에서 하단 inset을 먹이므로
 * WebView 뷰포트는 이미 네비게이션바 위에서 끝난다. 여기서 실제 inset을 또 넘기면
 * web이 같은 높이만큼 한 번 더 띄워 이중 여백이 된다.
 *
 * 0을 상수로 둔 이유: 주입 스크립트(safeAreaScript)와 브릿지(useHomeBridge) 두 곳이
 * 같은 값을 보내야 하고, 왜 0인지가 호출부에서 바로 보여야 한다.
 */
export const WEBVIEW_BOTTOM_INSET = 0;

/**
 * WebView(web)에 넘길 **상단** 안전영역 값.
 *
 * `useSafeAreaInsets()`를 그대로 쓰면 안 된다 — Android에서 첫 렌더에는 0이고, 그 0이
 * `injectedJavaScriptBeforeContentLoaded` 문자열에 굳어 web의 env() 폴백까지 덮는다.
 * 상단 UI가 상태바 자리로 올라가 글자가 겹쳤다가 뒤늦은 inset에 내려앉는 깜빡임이 그 결과다.
 *
 * `StatusBar.currentHeight`는 Android 첫 렌더에 이미 값이 있어 그것으로 받친다.
 * iOS는 이 값이 없고 insets가 처음부터 채워지므로 그대로 0이 된다.
 *
 * **web에 top을 보내는 모든 경로가 이 함수를 거쳐야 한다.** 주입 스크립트만 이 함수를 쓰고
 * 브릿지(useHomeBridge의 SAFE_AREA_UPDATE)가 raw `insets.top`을 보내던 동안, 첫 페인트는
 * 맞는데 PING flush가 곧바로 0으로 덮고 onLoadEnd 재주입이 다시 되돌리는 위아래 점프가 났다.
 * WEBVIEW_BOTTOM_INSET을 상수로 둔 것과 같은 이유다 — 두 경로의 값이 갈라지면 그게 곧 깜빡임이다.
 */
export function webViewTopInset(insetTop: number): number {
  if (insetTop > 0) return insetTop;
  return Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
}
