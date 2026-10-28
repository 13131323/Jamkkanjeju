import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useSinglePress } from '@/hooks/useSinglePress';
import {
  BUTTON_COMPACT_PADDING_HORIZONTAL,
  BUTTON_SIZE_LABEL_STYLES,
  BUTTON_SIZE_STYLES,
  DASHED_BUTTON_STYLE,
  DASHED_STYLES,
  BUTTON_TEXT_STYLE,
  ButtonColor,
  ButtonSize,
  DISABLED_STYLE,
  GHOST_BUTTON_STYLE,
  GHOST_STYLES,
  GRADIENT_BUTTON_STYLE,
  GRADIENT_COLORS,
  OUTLINE_STYLES,
  SOLID_STYLES,
} from './styles';

export type ButtonType = 'solid' | 'outline' | 'ghost' | 'gradient' | 'dashed';

interface ButtonProps {
  type?: ButtonType;
  size?: ButtonSize;
  color?: ButtonColor;
  /** 라벨을 Bold로. 미션 상세 CTA("퀴즈 시작하기" 등)가 Bold 16/24 */
  bold?: boolean;
  /**
   * 좌우 여백을 줄여 라벨 자리를 넓힌다(styles.ts BUTTON_COMPACT_PADDING_HORIZONTAL).
   * 폭을 부모가 정하는 2분할 CTA처럼 버튼 크기는 그대로인데 긴 라벨이 말줄임되는 자리에만 쓴다.
   */
  compact?: boolean;
  disabled?: boolean;
  text: string;
  onPress: () => void;
}

export function Button({
  type = 'solid',
  size = 'md',
  color = 'tertiary',
  bold = false,
  compact = false,
  disabled = false,
  text,
  onPress,
}: ButtonProps) {
  /**
   * 점선 테두리를 그릴 실제 폭(dp). `dashed` 유형에서만 쓴다.
   *
   * SVG는 "100% − 1"을 표현할 수 없어서 폭을 재야 한다 — 아래 dashed 분기의 주석 참고.
   * 다른 유형에서는 onLayout이 붙지 않아 0으로 남고 렌더에 관여하지 않는다.
   */
  const [borderWidth, setBorderWidth] = useState(0);

  const sizeStyle = BUTTON_SIZE_STYLES[size];
  // 사이즈가 정한 여백을 덮어쓴다 — 폭은 부모가 정하므로 라벨 자리만 넓어진다
  const compactStyle = compact ? { paddingHorizontal: BUTTON_COMPACT_PADDING_HORIZONTAL } : null;
  // 사이즈별 라벨 보정은 bold보다 뒤에 얹는다 — xs(12/16)에 Bold 16/24가 덮이면 라벨이 잘린다
  const sizeLabelStyle = BUTTON_SIZE_LABEL_STYLES[size] ?? null;
  const boldStyle = bold ? { fontFamily: 'Pretendard-Bold' } : null;
  // 연타를 한 번으로 접는다. 화면 이동 CTA가 대부분 이 컴포넌트를 쓰므로 여기서 막으면
  // 라우터 스택에 같은 화면이 두 번 쌓이는 걸 대부분 차단할 수 있다.
  const handlePress = useSinglePress(onPress);

  if (type === 'ghost') {
    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        className="items-center justify-center"
        style={[GHOST_BUTTON_STYLE, disabled && { opacity: 0.4 }]}
      >
        <Text numberOfLines={1} style={[BUTTON_TEXT_STYLE, boldStyle, GHOST_STYLES[color]]}>
          {text}
        </Text>
      </Pressable>
    );
  }

  // 점선 테두리는 Android에서 borderRadius와 함께 쓸 수 없어 SVG로 직접 그린다(styles.ts 참고)
  if (type === 'dashed') {
    const { stroke, text: textStyle } = DASHED_STYLES[color];
    const { height, borderRadius, strokeWidth, dashPattern } = DASHED_BUTTON_STYLE;
    const inset = strokeWidth / 2;

    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        onLayout={(event) => {
          const { width } = event.nativeEvent.layout;
          // 같은 값으로 setState를 반복하면 레이아웃 → 렌더 루프가 생긴다
          setBorderWidth((current) => (Math.round(current) === Math.round(width) ? current : width));
        }}
        style={[
          { height, justifyContent: 'center', borderRadius, backgroundColor: DASHED_BUTTON_STYLE.backgroundColor },
          disabled && { opacity: 0.4 },
        ]}
      >
        {/*
          테두리 레이어. **폭을 재서 숫자로 그린다.**

          예전에는 `x={inset} width="100%"`였는데, 그러면 사각형의 오른쪽 변이 SVG 폭보다
          `strokeWidth/2`만큼 밖으로 나가 잘렸다 — "오른쪽 테두리가 짤린다"의 원인이다.
          퍼센트로는 그 절반을 뺄 수 없어서(계산식을 못 쓴다) onLayout으로 실제 폭을 받는다.
          재기 전(0)에는 그리지 않는다 — 잘린 테두리가 한 프레임 스쳐 보이는 것보다 낫다.
      */}
        {borderWidth > 0 && (
          <Svg width={borderWidth} height={height} style={{ position: 'absolute' }}>
            <Rect
              x={inset}
              y={inset}
              width={borderWidth - strokeWidth}
              height={height - strokeWidth}
              rx={borderRadius}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={dashPattern}
            />
          </Svg>
        )}
        <View style={{ paddingHorizontal: 16 }}>
          <Text numberOfLines={1} style={[BUTTON_TEXT_STYLE, boldStyle, DASHED_BUTTON_STYLE.label, textStyle]}>
            {text}
          </Text>
        </View>
      </Pressable>
    );
  }

  if (type === 'gradient') {
    return (
      <Pressable onPress={handlePress} disabled={disabled} style={disabled && { opacity: 0.4 }}>
        <LinearGradient
          colors={GRADIENT_COLORS[color]}
          style={{ ...GRADIENT_BUTTON_STYLE, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text
            numberOfLines={1}
            style={[BUTTON_TEXT_STYLE, { fontFamily: 'Pretendard-Bold', color: '#ffffff' }]}
          >
            {text}
          </Text>
        </LinearGradient>
      </Pressable>
    );
  }

  const base = type === 'outline' ? OUTLINE_STYLES[color] : SOLID_STYLES[color];
  const variant = disabled ? DISABLED_STYLE : base;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      className="items-center justify-center"
      style={[sizeStyle, compactStyle, variant.container]}
    >
      <Text numberOfLines={1} style={[BUTTON_TEXT_STYLE, boldStyle, sizeLabelStyle, variant.text]}>
        {text}
      </Text>
    </Pressable>
  );
}
