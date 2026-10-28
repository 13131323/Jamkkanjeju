import { describe, expect, it } from 'vitest';
import { resolveHomeResetStrategy } from './homeResetStrategy';

const ENTRY = 'https://web.tamnalog.example';

describe('resolveHomeResetStrategy', () => {
  it('첫 페이지에 그대로 있으면 reload — 지울 히스토리가 없어 결과가 remount와 같다', () => {
    expect(resolveHomeResetStrategy({ currentUrl: ENTRY, entryUrl: ENTRY, canGoBack: false })).toBe('reload');
  });

  it('끝 슬래시와 fragment는 같은 문서로 본다 — WebView가 정규화한 주소를 돌려주기 때문이다', () => {
    expect(resolveHomeResetStrategy({ currentUrl: `${ENTRY}/`, entryUrl: ENTRY, canGoBack: false })).toBe('reload');
    expect(resolveHomeResetStrategy({ currentUrl: `${ENTRY}/#section`, entryUrl: ENTRY, canGoBack: false })).toBe('reload');
  });

  it('web이 다른 페이지로 갔으면 remount — reload는 그 주소를 다시 부를 뿐이다', () => {
    expect(resolveHomeResetStrategy({ currentUrl: `${ENTRY}/mypage`, entryUrl: ENTRY, canGoBack: true })).toBe('remount');
  });

  it('주소가 그대로여도 되돌아갈 항목이 있으면 remount — reload는 히스토리를 지우지 않는다', () => {
    expect(resolveHomeResetStrategy({ currentUrl: ENTRY, entryUrl: ENTRY, canGoBack: true })).toBe('remount');
  });

  it('쿼리가 붙었으면 다른 화면 상태로 보고 remount', () => {
    expect(resolveHomeResetStrategy({ currentUrl: `${ENTRY}/?tab=note`, entryUrl: ENTRY, canGoBack: false })).toBe('remount');
  });

  it('아직 navigation 상태를 못 받았으면 remount — 모를 때는 확실한 쪽으로 간다', () => {
    expect(resolveHomeResetStrategy({ currentUrl: null, entryUrl: ENTRY, canGoBack: false })).toBe('remount');
  });
});
