import { JUDGE_MODE_GLOBAL } from '@packages/shared';

/**
 * WebView 안의 web에 **심사위원용 모드의 출발값**을 심는 스크립트를 만든다.
 *
 * 브릿지가 아니라 주입인 이유는 토큰과 같다(authTokenScript.ts) — 브릿지는 페이지 로드 뒤에야
 * 오갈 수 있어 web의 첫 렌더·첫 요청이 항상 기본 모드로 지나간다. `injectedJavaScriptBeforeContentLoaded`는
 * 문서가 실행되기 전에 돌아 그 경쟁 자체가 없다.
 *
 * 전역 이름과 파싱 규칙은 `packages/shared`가 단일 출처다(JUDGE_MODE_GLOBAL) — 심는 쪽과 읽는 쪽이
 * 문자열을 각자 적으면 오타 하나가 조용히 "값이 없음"이 된다.
 *
 * 값은 `JSON.stringify`로 직렬화한다. 불리언이라 위험할 것은 없지만, 스크립트에 값을 이어붙이는
 * 자리는 예외 없이 직렬화를 거치게 둔다(authTokenScript.ts와 같은 규칙).
 *
 * @param enabled 앱이 아는 값. **아직 모르면 null**이고, 그때는 전역을 아예 심지 않는다 —
 *   web이 "값이 없다"를 보고 자기 localStorage로 떨어져야 하기 때문이다. `false`로 심으면
 *   web은 그것을 "앱이 꺼짐이라고 했다"로 읽고 저장값을 덮어쓴다(judgeModePersistence.ts).
 */
export function buildJudgeModeScript(enabled: boolean | null): string {
  if (enabled === null) {
    return `
    true;
  `;
  }

  return `
    (function () {
      window.${JUDGE_MODE_GLOBAL} = ${JSON.stringify(enabled)};
    })();
    true;
  `;
}
