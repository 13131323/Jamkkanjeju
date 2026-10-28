import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * 소프트 키보드가 화면 아래에서 덮는 높이(dp). 내려가 있으면 0.
 *
 * ## 왜 필요한가 — `adjustResize`가 더 이상 창을 줄이지 않는다
 *
 * AndroidManifest에는 `windowSoftInputMode="adjustResize"`가 그대로 있지만, 이 앱은
 * edge-to-edge다(`android/gradle.properties`의 `edgeToEdgeEnabled=true`). edge-to-edge는
 * `decorFitsSystemWindows`를 끄는 것이고, 그 순간 **창은 어떤 inset으로도 줄지 않는다** —
 * IME도 예외가 아니다. 키보드는 그냥 화면 위에 덮인다.
 *
 * 네이티브 화면이라면 각자 레이아웃을 밀면 되지만, 이 앱의 화면 대부분은 WebView다.
 * WebView가 줄지 않으면 **그 안의 web은 키보드가 떴다는 사실 자체를 모른다** — 뷰포트가
 * 그대로라 `100dvh`도, `position: fixed`도, `visualViewport`도 하나도 움직이지 않는다.
 * 안전영역(`safeAreaScript.ts`)과 같은 종류의 문제다: 네이티브만 아는 사실이라 네이티브가
 * 알려 주지 않으면 web은 영영 모른다.
 *
 * ## 왜 CSS 변수가 아니라 뷰 크기로 넘기는가
 *
 * 안전영역은 값을 CSS 변수로 심어 web이 쓰게 했지만, 키보드는 **뷰포트를 줄이는 쪽**이 맞다.
 * 값을 넘기면 그 값을 읽어 비켜 주는 코드를 화면마다 새로 써야 하는데, 뷰 높이를 줄이면
 * Chromium이 레이아웃 뷰포트를 다시 잡아 주므로 `h-dvh`·`fixed inset-0`을 쓰는 기존 web 화면이
 * 고치지 않아도 전부 따라온다. 원래 `adjustResize`가 해 주던 일을 그 자리에 되돌려 놓는 것이다.
 *
 * ## 높이의 기준점
 *
 * RN은 `WindowInsets.Type.ime()`에서 시스템 바 몫을 뺀 값을 준다
 * (`ReactRootView.checkForKeyboardEvents`). 이 앱의 루트 레이아웃은 이미 모든 화면에
 * `paddingBottom: max(insets.bottom, MIN_BOTTOM_INSET)`을 먹이고 있어서(`app/_layout.tsx`의
 * SafeAreaPadding) 화면 아래끝이 네비게이션바 위에서 끝난다 — 즉 두 값의 기준점이 같아
 * 그대로 쓰면 된다. 네비게이션바가 없는 기기에서만 루트가 받치는 16dp만큼 더 밀리는데,
 * 키보드 위 여백이 16dp 생기는 정도라 눈에 띄지 않는다.
 *
 * `keyboardWillShow`가 아니라 `keyboardDidShow`인 이유: will 계열은 iOS에만 있다. 두 플랫폼이
 * 같은 시점에 반응하도록 did로 맞춘다.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => setInset(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setInset(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return inset;
}
