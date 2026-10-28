import { Pressable, Text, TextStyle, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * Penpot "탐라로그 V2 / quiz" 컴포넌트의 세 가지 변형.
 * default(2번째) / selected(1번째, 선택 또는 정답 표시) / wrong(3번째, 선택했는데 오답)
 */
export type QuizOptionState = 'default' | 'selected' | 'wrong';

interface QuizOptionProps {
  label: string;
  state?: QuizOptionState;
  onPress?: () => void;
  disabled?: boolean;
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path d="M2.5 6L5 8.5L9.5 3.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function XMarkIcon({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path d="M3.5 3.5L8.5 8.5M8.5 3.5L3.5 8.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 상태색은 style 객체로 둔다(신규 Tailwind 클래스가 CSS 빌드 전까지 무시되는 문제를 피한다)
const STATE_STYLES: Record<QuizOptionState, { container: ViewStyle; text: TextStyle; indicator: ViewStyle; icon: string }> = {
  default: {
    container: { backgroundColor: '#ffffff', borderColor: '#ebebeb' },
    text: { color: '#2a2621' },
    indicator: { backgroundColor: '#f3f4f6' },
    icon: '#cccccc',
  },
  selected: {
    container: { backgroundColor: '#ecf9fd', borderColor: '#0da8dc' },
    text: { color: '#076c8d' },
    indicator: { backgroundColor: '#0da8dc' },
    icon: '#ffffff',
  },
  wrong: {
    container: { backgroundColor: '#feebeb', borderColor: '#e04444' },
    text: { color: '#b42828' },
    indicator: { backgroundColor: '#e04444' },
    icon: '#ffffff',
  },
};

// 디자인: 328x52, r16, 테두리 1.5 inner, 좌우 패딩 16, 라벨 16/24, 인디케이터 20x20
export function QuizOption({ label, state = 'default', onPress, disabled = false }: QuizOptionProps) {
  const styles = STATE_STYLES[state];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="flex-row items-center justify-between"
      style={[{ height: 52, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16 }, styles.container]}
    >
      <Text style={[{ fontFamily: 'Pretendard-Medium', fontSize: 16, lineHeight: 24 }, styles.text]}>{label}</Text>
      <View className="items-center justify-center" style={[{ width: 20, height: 20, borderRadius: 10 }, styles.indicator]}>
        {/* 미선택도 회색 체크가 보인다 */}
        {state === 'wrong' ? <XMarkIcon color={styles.icon} /> : <CheckIcon color={styles.icon} />}
      </View>
    </Pressable>
  );
}
