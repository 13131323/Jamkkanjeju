import { HomeWebView } from '@/components/HomeWebView/HomeWebView';

// 카메라 이외의 화면은 WebView로 web 패키지를 로드한다 (CLAUDE_APP.md).
// 헤더는 루트 레이아웃에서 전역으로 꺼둔다.
//
// 하단 안전영역은 다른 화면과 똑같이 루트 레이아웃(SafeAreaPadding)이 네이티브에서 먹인다.
// 예전에는 FullBleed로 그 padding을 취소하고 web이 CSS 변수로 직접 처리하게 했는데,
// 그러면 값이 WebView 안까지 도달해야만 하단 UI가 네비게이션바를 피할 수 있었다.
// 주입 경로가 한 번이라도 어긋나면 조용히 가려지므로
// 네이티브가 뷰포트 자체를 네비게이션바 위에서 끝내는 쪽으로 바꿨다.
// 상단은 루트가 건드리지 않으므로 web이 --safe-area-top으로 계속 직접 처리한다.
export default function Home() {
  return <HomeWebView />;
}
