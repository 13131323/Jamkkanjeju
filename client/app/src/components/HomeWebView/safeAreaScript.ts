export interface SafeAreaInsets {
  top: number;
  bottom: number;
}

/**
 * WebView 안의 web 페이지에 안전영역 크기를 CSS 변수로 심는 스크립트를 만든다.
 *
 * Android WebView는 RN 뷰 계층 안에 놓이는 자식이라 시스템 바의 존재를 모른다.
 * 그래서 웹 쪽 env(safe-area-inset-*)는 항상 0이고, 네이티브가 값을 넘겨줘야 한다.
 *
 * 마지막 `true;`는 injectJavaScript 때문이다. 주입한 스크립트의 마지막 평가값을
 * WebView가 네이티브로 직렬화해 보내는데, 값이 객체면 그 과정에서 경고가 뜬다.
 */
export function buildSafeAreaScript({ top, bottom }: SafeAreaInsets): string {
  const topPx = Math.round(top);
  const bottomPx = Math.round(bottom);

  return `
    (function () {
      var root = document.documentElement;
      root.style.setProperty('--safe-area-top', '${topPx}px');
      root.style.setProperty('--safe-area-bottom', '${bottomPx}px');
    })();
    true;
  `;
}
