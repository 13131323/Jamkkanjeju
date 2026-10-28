/**
 * "홈을 처음 상태로 되돌린다"(store/homeReset.ts)를 **어떻게** 이룰지 고르는 규칙.
 *
 * 두 수단의 결과는 같아야 하고, 비용만 다르다.
 *
 * - `remount`: WebView를 key로 통째로 새로 만든다. 네이티브 뷰와 렌더러 프로세스가 버려졌다가
 *   다시 생기므로 **반드시 빈(흰) 화면을 한 번 거친다.** 그 대신 web 히스토리까지 통째로 사라진다.
 * - `reload`: 같은 WebView에서 지금 문서를 다시 불러온다. JS 컨텍스트가 새로 만들어지므로
 *   web의 QueryClient도 새것이 되어 **캐시 신선도 보장은 remount와 똑같다.** 네이티브 뷰가
 *   살아 있어 HTTP 캐시와 렌더러가 그대로이고, 크로미움이 새 문서의 첫 페인트까지 이전 화면을
 *   붙들고 있어 빈 화면 구간이 짧다.
 *
 * 차이가 나는 지점은 **web 히스토리 하나뿐**이다. reload는 히스토리를 지우지 않는다.
 * 그래서 web이 자기 히스토리를 따라 어딘가로 이동한 상태(마이페이지 → 도감 카드 …)에서는
 * reload가 "첫 화면으로 되돌린다"를 만족하지 못한다 — 그때만 remount를 쓴다.
 *
 * 반대로 web이 **들어온 그 페이지에 그대로 있으면**(뒤로 갈 곳이 없고 주소도 그대로) 지울
 * 히스토리가 없으므로 reload의 결과가 remount와 글자 그대로 같다. 이 경우가 미션 완료 직후의
 * 정상 경로다 — 미션은 홈 배너에서 시작하므로 WebView는 아직 첫 페이지에 있다.
 */
export type HomeResetStrategy = 'reload' | 'remount';

/**
 * 같은 문서를 가리키는 주소인가.
 *
 * 끝 슬래시와 fragment만 무시한다. 쿼리는 **무시하지 않는다** — web에서 쿼리가 바뀌었다면
 * 그건 다른 화면 상태라 "첫 화면"이 아니고, 그때는 remount로 가는 편이 안전하다.
 */
function isSameDocument(a: string, b: string): boolean {
  const normalize = (url: string) => url.trim().split('#')[0].replace(/\/+$/, '');
  return normalize(a) === normalize(b);
}

/**
 * @param currentUrl WebView가 지금 띄우고 있는 주소. 첫 로드 전이라 아직 모르면 null.
 * @param entryUrl WebView를 만들 때 넘긴 주소(= web의 첫 화면).
 * @param canGoBack web 히스토리에 되돌아갈 항목이 있는가.
 */
export function resolveHomeResetStrategy({ currentUrl, entryUrl, canGoBack }: { currentUrl: string | null; entryUrl: string; canGoBack: boolean }): HomeResetStrategy {
  // 되돌아갈 항목이 있으면 지워야 할 히스토리가 있다는 뜻이다 — reload로는 지워지지 않는다
  if (canGoBack) return 'remount';

  // 아직 한 번도 navigation 상태를 받지 못했다. 무엇이 떠 있는지 모르는 채로 가벼운 수단을
  // 고르면 "낡은 화면이 남는" 쪽으로 틀릴 수 있으므로, 모를 때는 확실한 remount로 간다.
  if (currentUrl === null) return 'remount';

  return isSameDocument(currentUrl, entryUrl) ? 'reload' : 'remount';
}
