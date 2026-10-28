/**
 * 뒤로가기를 웹 히스토리로 처리할지, 앱 네이티브 스택으로 넘길지 판단한다.
 *
 * 앱 WebView는 화면에 따라 web 경로를 **첫 페이지로** 열기도 하고(그땐 돌아갈 웹 히스토리가 없어
 * 앱에게 pop을 부탁해야 한다), 지도·검색처럼 web 안에서 push로 들어오기도 한다. 후자까지 앱 스택을
 * pop하면 사용자가 보던 web 화면을 건너뛰고 앱 화면이 닫힌다.
 */

export type BackTarget = 'web-history' | 'app-stack' | 'map-fallback';

type BackContext = {
  /** Navigation API의 canGoBack. 지원하지 않는 구형 WebView에서는 null */
  canGoBack: boolean | null;
  isInitialPath: boolean;
  isWebView: boolean;
};

export function resolveBackTarget({ canGoBack, isInitialPath, isWebView }: BackContext): BackTarget {
  // canGoBack이 브라우저의 정답이다. 없을 때만 최초 경로 비교로 대신한다.
  const hasWebHistory = canGoBack ?? !isInitialPath;

  if (hasWebHistory) return 'web-history';
  return isWebView ? 'app-stack' : 'map-fallback';
}

let initialPathname: string | null = null;

/**
 * 문서가 처음 열린 경로를 기억한다. 루트(providers)에서 한 번 부른다.
 *
 * 상세 화면에서 부르면 client navigation 시점에 잡혀 "현재 경로"와 같아지므로 판단 근거가 되지 못한다.
 */
export function rememberInitialPathname(): void {
  if (initialPathname === null && typeof window !== 'undefined') {
    initialPathname = window.location.pathname;
  }
}

/** 현재 화면이 문서가 처음 열린 그 경로인지 */
export function isInitialPathname(): boolean {
  if (typeof window === 'undefined') return true;
  return initialPathname === window.location.pathname;
}

/** Navigation API를 지원하면 canGoBack을, 아니면 null을 준다 */
export function readCanGoBack(): boolean | null {
  if (typeof window === 'undefined') return null;
  const navigation = (window as { navigation?: { canGoBack?: boolean } }).navigation;
  return typeof navigation?.canGoBack === 'boolean' ? navigation.canGoBack : null;
}
