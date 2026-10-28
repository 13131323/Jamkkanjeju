import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from './providers';
import { pretendard } from '@shared/lib/fonts/pretendard';

export const metadata: Metadata = {
  title: 'TamnaLog',
  description: 'TamnaLog',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // WebView가 네이티브 앱 화면처럼 보여야 하므로 브라우저 기본 핀치줌(페이지 확대/축소)을 막는다.
  // 카카오맵 등 화면 내부의 자체 줌 기능은 SDK가 직접 처리해 이 설정과 무관하다.
  maximumScale: 1,
  userScalable: false,
  // 안전영역 뒤까지 콘텐츠를 그리고 env(safe-area-inset-*)를 살린다
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 앱 WebView는 hydration 전에(injectedJavaScriptBeforeContentLoaded) <html>의 inline style로
    // --safe-area-* 를 심는다. 서버 HTML에는 그 속성이 없으므로 React가 mismatch로 보고 경고한다.
    // 의도된 외부 변경이라 이 엘리먼트의 속성 비교만 끈다(자식 트리에는 영향 없음).
    <html lang="ko" className={pretendard.variable} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
