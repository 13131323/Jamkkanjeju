import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_SCHEME, COOP_INVITE_APP_LINK_HOST, COOP_INVITE_APP_PATH, COOP_INVITE_PATH } from './inviteUrl';

/**
 * 초대 링크가 앱을 여는 데 필요한 조각들이 **서로 어긋나지 않는지** 고정한다.
 *
 * ## 왜 이 테스트가 있어야 하나
 *
 * Android App Link 한 번이 성립하려면 다섯 곳이 동시에 맞아야 한다.
 *
 * | 자리                                             | 무엇이 맞아야 하나                  |
 * | ------------------------------------------------ | ----------------------------------- |
 * | `src/config/inviteUrl.ts`                        | 공유되는 https 링크의 host·path     |
 * | `app.json` `expo.android.intentFilters`          | 같은 host·pathPrefix, `autoVerify`  |
 * | `app/cooperative-missions/invite.tsx`            | https 경로와 같은 라우트 파일 경로  |
 * | `web/src/app/cooperative-missions/invite/`       | 그 https 경로의 web 랜딩            |
 * | `web/public/.well-known/assetlinks.json`         | 앱 패키지명 + 서명 인증서 SHA-256   |
 *
 * 하나만 어긋나도 증상이 조용하다. pathPrefix가 다르면 링크가 브라우저로 새고, 라우트 파일
 * 경로가 다르면 **앱은 뜨는데 초대 화면이 안 나온다**. 지문이 틀리면 검증만 실패해서
 * 개발자 기기에서는 멀쩡해 보이다가 스토어 빌드에서만 안 열린다. 손으로 재현하려면 매번
 * 앱을 지웠다 깔고 링크를 눌러야 해서, 회귀를 알아챌 방법이 여기 말고는 없다.
 *
 * ## 서명 지문에 대하여
 *
 * `assetlinks.json`의 SHA-256은 **앱을 실제로 서명한 인증서의 지문**이다. 이 앱은 원스토어로
 * 배포하고, 원스토어에는 구글플레이의 Play App Signing 같은 재서명 장치가 없어서
 * **EAS가 들고 있는 키스토어가 곧 앱 서명 키**다(`app/README.md`의 "서명키").
 * 그래서 README에 적힌 지문이 그대로 정답이고, 이 테스트가 둘을 묶어 둔다.
 *
 * 지문을 다시 확인하려면:
 *   `cd app && npx eas-cli credentials --platform android`  (Keystore → 지문 확인)
 *   또는 받은 APK에 대해 `keytool -printcert -jarfile <파일>.apk`
 *
 * 구글플레이에도 올리게 되면 플레이가 **다른 키로 재서명**하므로 지문이 하나 더 필요하다.
 * Play Console → 설정 → 앱 무결성 → 앱 서명 키 인증서의 SHA-256을 배열에 **추가**한다
 * (기존 것을 지우면 원스토어 설치본의 검증이 깨진다).
 */

const APP_DIR = fileURLToPath(new URL('../../', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));
const exists = (path: string): boolean => {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
};

type ExpoConfigShape = {
  expo: {
    scheme: string;
    android: {
      package: string;
      intentFilters?: {
        action?: string;
        autoVerify?: boolean;
        category?: string[];
        data?: { scheme?: string; host?: string; pathPrefix?: string }[];
      }[];
    };
  };
};

type AssetLinksShape = {
  relation: string[];
  target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] };
}[];

const appJson = readJson(`${APP_DIR}app.json`) as ExpoConfigShape;
const assetLinks = readJson(`${REPO_ROOT}web/public/.well-known/assetlinks.json`) as AssetLinksShape;
const appReadme = readFileSync(`${APP_DIR}README.md`, 'utf8');

/** `AA:BB:…` / `aabb…` 어느 표기로 적혀 있어도 같은 지문이면 같게 본다 */
const normalizeFingerprint = (value: string): string => value.replace(/:/g, '').toLowerCase();

describe('app.json의 Android App Link 설정', () => {
  const appLinkFilters = (appJson.expo.android.intentFilters ?? []).filter((filter) => filter.data?.some((data) => data.scheme === 'https'));

  it('https 초대 링크를 잡는 intent filter가 정확히 하나 있다', () => {
    // 여러 개로 늘어나면 어느 것이 실제로 검증되는지 추적이 어려워진다.
    expect(appLinkFilters).toHaveLength(1);
  });

  it('autoVerify가 켜져 있다 — 없으면 안드로이드가 링크를 검증하지 않아 늘 브라우저로 샌다', () => {
    expect(appLinkFilters[0].autoVerify).toBe(true);
  });

  it('브라우저가 넘기는 인텐트를 받을 수 있는 action·category를 갖는다', () => {
    expect(appLinkFilters[0].action).toBe('VIEW');
    // BROWSABLE이 없으면 브라우저에서 넘어온 인텐트를 받지 못한다.
    expect(appLinkFilters[0].category).toEqual(expect.arrayContaining(['BROWSABLE', 'DEFAULT']));
  });

  it('링크를 조립할 때 쓰는 host·path와 같은 값을 잡는다', () => {
    const [data] = appLinkFilters[0].data ?? [];
    expect(data.scheme).toBe('https');
    expect(data.host).toBe(COOP_INVITE_APP_LINK_HOST);
    expect(data.pathPrefix).toBe(COOP_INVITE_PATH);
  });

  it('pathPrefix를 초대 경로로 좁힌다 — 도메인 전체를 잡으면 web의 모든 링크가 앱을 열려 든다', () => {
    const [data] = appLinkFilters[0].data ?? [];
    expect(data.pathPrefix).not.toBe('/');
    expect(data.pathPrefix?.length).toBeGreaterThan(1);
  });

  it('커스텀 스킴을 그대로 둔다 — web 랜딩의 폴백과 iOS 경로가 여기에 기댄다', () => {
    expect(appJson.expo.scheme).toBe(APP_SCHEME);
  });
});

describe('경로 문자열이 네 자리에서 같다', () => {
  it('App Link가 착지할 앱 라우트 파일이 https 경로와 같은 자리에 있다', () => {
    // 이 파일이 없으면 링크는 앱을 열고도 초대 화면에 도달하지 못한다.
    expect(exists(`${APP_DIR}app${COOP_INVITE_PATH}.tsx`)).toBe(true);
  });

  it('커스텀 스킴이 착지할 라우트 파일도 남아 있다', () => {
    expect(exists(`${APP_DIR}app${COOP_INVITE_APP_PATH}.tsx`)).toBe(true);
  });

  it('web 랜딩이 같은 경로에 있다 — App Link 검증 전이나 앱이 없을 때 여기로 떨어진다', () => {
    expect(exists(`${REPO_ROOT}web/src/app${COOP_INVITE_PATH}/page.tsx`)).toBe(true);
  });

  it('web이 쓰는 경로 상수가 앱의 경로 상수와 같다', () => {
    const webModule = readFileSync(`${REPO_ROOT}web/src/app${COOP_INVITE_PATH}/coopInviteAppLink.ts`, 'utf8');
    expect(webModule).toContain(`export const COOP_INVITE_WEB_PATH = '${COOP_INVITE_PATH}';`);
    expect(webModule).toContain(`export const COOP_INVITE_APP_PATH = '${COOP_INVITE_APP_PATH}';`);
    expect(webModule).toContain(`export const APP_SCHEME = '${APP_SCHEME}';`);
  });
});

describe('assetlinks.json', () => {
  it('App Link 검증이 요구하는 형태다', () => {
    expect(assetLinks).toHaveLength(1);
    expect(assetLinks[0].relation).toEqual(['delegate_permission/common.handle_all_urls']);
    expect(assetLinks[0].target.namespace).toBe('android_app');
  });

  it('정식 배포 패키지명을 가리킨다 — dev/preview 접미사가 붙은 패키지가 아니다', () => {
    // app.config.ts가 development/preview에만 접미사를 붙이므로 app.json 값이 곧 production 패키지다.
    expect(assetLinks[0].target.package_name).toBe(appJson.expo.android.package);
  });

  it('README에 적힌 EAS 키스토어의 SHA-256과 같다', () => {
    // 원스토어에는 재서명이 없어 이 키스토어가 곧 앱 서명 키다(파일 상단 주석).
    const documented = appReadme.match(/SHA-256\s*\|\s*`([0-9a-fA-F:]+)`/)?.[1];
    expect(documented, 'app/README.md의 서명키 표에서 SHA-256을 찾지 못했다').toBeTruthy();
    expect(assetLinks[0].target.sha256_cert_fingerprints.map(normalizeFingerprint)).toContain(normalizeFingerprint(documented as string));
  });

  it('지문이 안드로이드가 읽는 표기(대문자 콜론 구분 32바이트)다', () => {
    for (const fingerprint of assetLinks[0].target.sha256_cert_fingerprints) {
      expect(fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    }
  });
});
