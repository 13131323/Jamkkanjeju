import type { ConfigContext, ExpoConfig } from 'expo/config';

const PRODUCTION_URL_ERROR =
  'EXPO_PUBLIC_WEB_URL must be configured with a public HTTPS domain for production.';

function isIpLiteral(hostname: string): boolean {
  const unwrappedHostname = hostname.replace(/^\[|\]$/g, '');
  return unwrappedHostname.includes(':') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(unwrappedHostname);
}

export function validateProductionWebUrl(
  appEnv: string | undefined,
  webUrl: string | undefined,
): void {
  if (appEnv !== 'production') {
    return;
  }

  if (!webUrl) {
    throw new Error(PRODUCTION_URL_ERROR);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webUrl);
  } catch {
    throw new Error(PRODUCTION_URL_ERROR);
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const isLocalHostname =
    hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local');

  if (
    parsedUrl.protocol !== 'https:' ||
    !hostname.includes('.') ||
    isLocalHostname ||
    isIpLiteral(hostname)
  ) {
    throw new Error(PRODUCTION_URL_ERROR);
  }
}

// eas.json의 각 빌드 프로필이 APP_ENV를 주입한다(development/preview/production).
// `pnpm dev:app`처럼 EAS를 거치지 않는 로컬 실기기 빌드는 APP_ENV가 없으므로 development로 간주한다.
//
// 패키지명이 같으면 안드로이드가 "같은 앱"으로 취급해 정식 배포 앱을 설치하면 개발용 빌드가
// 지워진다(서명이 다르면 설치 자체가 막힌다). production만 app.json의 원래 패키지명을 쓰고
// 나머지는 접미사를 붙여 기기에 동시에 설치되도록 한다.
const PACKAGE_SUFFIX: Partial<Record<string, string>> = {
  development: '.dev',
  preview: '.preview',
};
const NAME_SUFFIX: Partial<Record<string, string>> = {
  development: ' (Dev)',
  preview: ' (Preview)',
};

export default ({ config }: ConfigContext): ExpoConfig => {
  validateProductionWebUrl(process.env.APP_ENV, process.env.EXPO_PUBLIC_WEB_URL);

  const appEnv = process.env.APP_ENV ?? 'development';
  const expoConfig = config as ExpoConfig;

  return {
    ...expoConfig,
    name: `${expoConfig.name}${NAME_SUFFIX[appEnv] ?? ''}`,
    android: {
      ...expoConfig.android,
      package: `${expoConfig.android?.package}${PACKAGE_SUFFIX[appEnv] ?? ''}`,
      // App Link(https 초대 링크)는 production 빌드만 주장한다.
      //
      // 검증은 `https://{host}/.well-known/assetlinks.json`이 "이 패키지 + 이 서명 지문"을
      // 인정해야 통과하는데, 그 파일에는 정식 패키지(`com.tamnalog.app`)와 그 서명 지문만
      // 들어 있다. dev/preview는 패키지에 접미사가 붙고 키스토어도 달라 애초에 검증될 수 없다.
      //
      // 그런데도 필터를 남겨 두면, 개발자 기기처럼 dev/preview 빌드가 함께 깔린 곳에서
      // 초대 링크를 눌렀을 때 "어느 앱으로 열까" 선택 창이 뜰 수 있다(검증되지 않은 핸들러도
      // 수동 선택 목록에는 나온다). 링크는 정식 앱 하나로만 가야 하므로 여기서 떼어 낸다.
      intentFilters: appEnv === 'production' ? expoConfig.android?.intentFilters : undefined,
    },
  };
};
