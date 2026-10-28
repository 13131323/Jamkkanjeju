import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCoopInviteAppLink, COOP_INVITE_APP_PATH, COOP_INVITE_WEB_PATH } from './coopInviteAppLink';

describe('buildCoopInviteAppLink', () => {
  it('토큰을 앱 스킴 주소로 옮긴다', () => {
    expect(buildCoopInviteAppLink('abc123')).toBe('tamnalog:///mission/invite?token=abc123');
  });

  it('호스트를 비워 둬 경로가 잘리지 않는다', () => {
    // `tamnalog://mission/invite`는 `mission`이 호스트로 읽혀 경로가 `/invite`만 남는 파서가 있다
    expect(buildCoopInviteAppLink('abc123')).toContain(`://${COOP_INVITE_APP_PATH}`);
  });

  it('URL에서 뜻이 있는 문자를 인코딩한다 — 앱의 buildInviteAppLink와 같은 규칙이다', () => {
    expect(buildCoopInviteAppLink('a+b/c d')).toBe('tamnalog:///mission/invite?token=a%2Bb%2Fc%20d');
  });

  it('토큰이 없으면 null이다 — 방을 찾지 못하는 주소로 앱을 깨우지 않는다', () => {
    expect(buildCoopInviteAppLink(null)).toBeNull();
    expect(buildCoopInviteAppLink(undefined)).toBeNull();
    expect(buildCoopInviteAppLink('')).toBeNull();
    expect(buildCoopInviteAppLink('   ')).toBeNull();
  });
});

describe('COOP_INVITE_WEB_PATH', () => {
  const WEB_DIR = fileURLToPath(new URL('../../../../', import.meta.url));

  it('이 랜딩 페이지가 실제로 그 경로에 있다', () => {
    // App Link는 https 주소를 바꾸지 않고 앱에 넘긴다. 이 경로가 곧 앱이 찾을 라우트 경로이므로
    // 상수와 디렉터리가 갈리면 "앱은 열리는데 화면이 안 나온다"가 된다.
    expect(() => readFileSync(`${WEB_DIR}src/app${COOP_INVITE_WEB_PATH}/page.tsx`)).not.toThrow();
  });

  it('이 파일 자신이 그 디렉터리 안에 있다', () => {
    expect(
      fileURLToPath(import.meta.url)
        .split('\\')
        .join('/'),
    ).toContain(`src/app${COOP_INVITE_WEB_PATH}/`);
  });

  it('앱 스킴 경로와는 다른 경로다 — 두 진입은 경로가 다르고 화면만 같다', () => {
    expect(COOP_INVITE_WEB_PATH).not.toBe(COOP_INVITE_APP_PATH);
  });
});
