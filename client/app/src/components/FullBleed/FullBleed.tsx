import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MIN_BOTTOM_INSET } from '@/styles/safeArea';

interface FullBleedProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * 루트 레이아웃이 걸어둔 하단 안전영역 padding을 취소해 화면 끝까지 그리게 한다.
 *
 * 대부분의 화면은 루트 padding만으로 충분하지만, 아래 화면들은 네비게이션바 뒤까지
 * 배경이 이어져야 해서 예외가 필요하다.
 *   - 카메라 프리뷰·지도: 잘리면 안 되는 전체화면 콘텐츠
 *   - MissionIntroLayout: 배경 그라디언트가 화면 끝까지 이어진다
 *
 * /home(WebView)은 예전에 여기 속했지만, 안전영역 값이 WebView 안까지 도달해야만
 * 하단 UI가 네비게이션바를 피하는 구조가 취약해서 루트 padding을 그대로 받도록 되돌렸다.
 *
 * 상단은 루트가 건드리지 않으므로 취소할 것도 없다.
 * 이 안에서는 하단 안전영역이 사라지므로, 눌러야 하는 요소는 각자 insets를 읽어 배치해야 한다.
 */
export function FullBleed({ children, style }: FullBleedProps) {
  const insets = useSafeAreaInsets();

  return <View style={[{ flex: 1, marginBottom: -Math.max(insets.bottom, MIN_BOTTOM_INSET) }, style]}>{children}</View>;
}
