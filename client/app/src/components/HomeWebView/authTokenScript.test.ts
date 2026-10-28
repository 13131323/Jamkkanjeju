import { describe, expect, it } from 'vitest';
import { buildAuthTokenScript, WEB_APP_INFO_GLOBAL, WEB_AUTH_GLOBAL, WEB_AUTH_READY_EVENT } from './authTokenScript';

const APP_INFO = { version: '1.1.0', apiOrigin: 'https://api.example.com' };

describe('buildAuthTokenScript', () => {
  it('토큰이 없으면 전역을 null로 심는다 — web이 "아직 없음"과 "빈 문자열"을 구분할 수 있어야 한다', () => {
    const script = buildAuthTokenScript(null, APP_INFO);

    expect(script).toContain(`${WEB_AUTH_GLOBAL} = null`);
    expect(script.trimEnd().endsWith('true;')).toBe(true);
  });

  it('토큰을 전역에 심고 준비 이벤트를 쏜다', () => {
    const script = buildAuthTokenScript({ accessToken: 'abc123', tokenType: 'Bearer' }, APP_INFO);

    expect(script).toContain('"accessToken":"abc123"');
    expect(script).toContain('"tokenType":"Bearer"');
    expect(script).toContain(WEB_AUTH_READY_EVENT);
  });

  it('따옴표·백슬래시가 든 토큰도 스크립트를 깨지 않는다', () => {
    const nasty = `a"b\\c'd`;
    const script = buildAuthTokenScript({ accessToken: nasty, tokenType: 'Bearer' }, APP_INFO);

    // JSON.stringify로 직렬화하므로 원문 따옴표가 그대로 노출되지 않는다
    expect(script).toContain(JSON.stringify(nasty));
    expect(script).not.toContain(`accessToken":"a"b`);
  });

  it('스크립트 종료 문자를 포함한 토큰이 와도 문자열 리터럴 밖으로 새지 않는다', () => {
    const script = buildAuthTokenScript({ accessToken: '</script>', tokenType: 'Bearer' }, APP_INFO);

    expect(script).toContain(JSON.stringify('</script>'));
  });

  it('마지막 평가값을 true로 끝낸다 — injectJavaScript가 객체를 직렬화하며 경고를 내지 않도록', () => {
    expect(buildAuthTokenScript({ accessToken: 'a', tokenType: 'Bearer' }, APP_INFO).trimEnd().endsWith('true;')).toBe(true);
  });

  it('앱 정보를 함께 심는다 — 이 전역의 부재가 web이 낡은 앱을 알아보는 유일한 단서다', () => {
    const script = buildAuthTokenScript(null, APP_INFO);

    expect(script).toContain(`${WEB_APP_INFO_GLOBAL} = `);
    expect(script).toContain('"version":"1.1.0"');
    expect(script).toContain('"apiOrigin":"https://api.example.com"');
  });

  it('앱 정보를 토큰보다 먼저 심는다 — auth-ready를 듣고 깨는 쪽이 앱 정보를 이미 볼 수 있어야 한다', () => {
    const script = buildAuthTokenScript({ accessToken: 'a', tokenType: 'Bearer' }, APP_INFO);

    expect(script.indexOf(WEB_APP_INFO_GLOBAL)).toBeLessThan(script.indexOf(WEB_AUTH_GLOBAL));
  });

  it('토큰이 없어도 앱 정보는 심는다 — 재발급으로 복구할 수 있는 앱임을 web이 알아야 한다', () => {
    const script = buildAuthTokenScript(null, APP_INFO);

    expect(script).toContain(`${WEB_AUTH_GLOBAL} = null`);
    expect(script).toContain('"version":"1.1.0"');
  });
});
