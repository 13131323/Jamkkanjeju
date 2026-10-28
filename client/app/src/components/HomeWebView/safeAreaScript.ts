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
 * 문서 파싱 전에 주입되면 `document.documentElement`가 아직 없거나, 있더라도 파싱이 시작될 때
 * 교체되어 여기서 심은 인라인 스타일이 사라진다. 그러면 첫 페인트가 inset 없이 그려졌다가
 * onLoadEnd 재주입에 내려앉는 위아래 점프가 난다 — DOMContentLoaded에서 한 번 더 심어 받친다.
 *
 * 마지막 `true;`는 injectJavaScript 때문이다. 주입한 스크립트의 마지막 평가값을
 * WebView가 네이티브로 직렬화해 보내는데, 값이 객체면 그 과정에서 경고가 뜬다.
 */
export function buildSafeAreaScript({ top, bottom }: SafeAreaInsets): string {
  const topPx = Math.round(top);
  const bottomPx = Math.round(bottom);

  return `
    (function () {
      function apply() {
        var root = document.documentElement;
        if (!root) return;
        root.style.setProperty('--safe-area-top', '${topPx}px');
        root.style.setProperty('--safe-area-bottom', '${bottomPx}px');
      }
      apply();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply, { once: true });
      }
    })();
    true;
  `;
}
