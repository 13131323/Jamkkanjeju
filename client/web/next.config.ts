import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';
import path from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  // @packages/shared는 빌드 산출물 없이 TS 소스를 그대로 내보내므로 Next가 직접 트랜스파일해야 한다.
  transpilePackages: ['@packages/shared'],
  outputFileTracingRoot: path.join(__dirname, '..'),
  ...(process.env.ALLOWED_DEV_ORIGIN && {
    allowedDevOrigins: [process.env.ALLOWED_DEV_ORIGIN],
  }),

  /**
   * [dev 전용] API 프록시.
   *
   * 배포 API를 로컬에서 볼 때만 쓴다. 앱 WebView는 web을 http://localhost:3000에서 읽는데
   * 배포 서버의 CORS 허용 목록에 그 origin이 없어서, 브라우저가 응답을 버린다
   * (Access-Control-Allow-Origin이 오지 않고 preflight는 400이다). Next 서버가 대신 전달하면
   * 브라우저는 same-origin으로만 통신하므로 CORS가 발생하지 않는다.
   *
   * NEXT_PUBLIC_API_PROXY_PATH가 없으면 rewrite를 만들지 않는다 — 프로덕션에서는 설정하지 않아
   * 절대주소로 직접 호출하는 원래 경로를 탄다.
   */
  async rewrites() {
    const proxyPath = process.env.NEXT_PUBLIC_API_PROXY_PATH;
    const upstream = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!proxyPath || !upstream) return [];

    return [
      {
        source: `${proxyPath}/:path*`,
        destination: `${upstream.replace(/\/+$/, '')}/:path*`,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: 'tamnalog',
  project: 'tamnalog-web',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
});
