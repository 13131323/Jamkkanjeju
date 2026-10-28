import { describe, expect, it } from 'vitest';
import { resolveBackTarget } from './navigationHistory';

describe('resolveBackTarget', () => {
  it('Navigation API가 뒤로 갈 수 있다고 하면 웹 히스토리를 쓴다', () => {
    expect(resolveBackTarget({ canGoBack: true, isInitialPath: true, isWebView: true })).toBe('web-history');
  });

  it('앱이 첫 페이지로 연 WebView면 앱 스택을 pop한다', () => {
    expect(resolveBackTarget({ canGoBack: false, isInitialPath: true, isWebView: true })).toBe('app-stack');
  });

  // canGoBack이 false면 브라우저가 "돌아갈 곳 없음"을 확정한 것이라 경로 비교보다 우선한다 —
  // 여기서 router.back()을 부르면 아무 일도 일어나지 않아 사용자가 갇힌다.
  it('canGoBack이 false면 최초 경로가 아니어도 앱 스택을 pop한다', () => {
    expect(resolveBackTarget({ canGoBack: false, isInitialPath: false, isWebView: true })).toBe('app-stack');
  });

  // Navigation API가 없는 구형 WebView — 문서 최초 경로와 현재 경로를 비교해 대신 판단한다
  it('canGoBack을 모를 때 최초 경로와 다르면 웹 히스토리로 본다', () => {
    expect(resolveBackTarget({ canGoBack: null, isInitialPath: false, isWebView: true })).toBe('web-history');
  });

  it('canGoBack을 모르고 최초 경로 그대로면 앱 스택을 pop한다', () => {
    expect(resolveBackTarget({ canGoBack: null, isInitialPath: true, isWebView: true })).toBe('app-stack');
  });

  // 일반 브라우저에서 URL로 바로 들어온 경우 — 지금은 router.back()이 아무 일도 하지 않아 갇힌다
  it('WebView가 아니고 돌아갈 히스토리도 없으면 지도로 보낸다', () => {
    expect(resolveBackTarget({ canGoBack: false, isInitialPath: true, isWebView: false })).toBe('map-fallback');
  });
});
