import { useEffect, useState } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

/**
 * 자리표시 블록.
 *
 * 두 가지로 쓴다.
 *   1. 로딩 중(기본): 응답을 기다리는 동안 실제 값이 들어갈 자리를 잡아 둔다. 값이 와도
 *      레이아웃이 튀지 않는다. 정지한 회색 박스만 두면 "멈춘 화면"처럼 보여 투명도를 천천히 오간다.
 *   2. 영영 채워지지 않는 빈 자리(`pulse={false}`): 서버가 사진을 주지 않은 장소 카드처럼
 *      기다려도 값이 오지 않는 자리. 이때 계속 반짝이면 영원히 로딩 중인 것처럼 보이므로 멈춘다.
 *
 * 최상위(components/)에 두는 이유: 미션에 묶인 로직이 없는 UI 조각이고, 미션 인트로·완료·
 * 재진입 세 레이아웃이 함께 쓴다. 한 레이아웃 폴더 안에 두면 다른 폴더가 그 안을 들여다봐야 한다.
 */
const PULSE_MS = 900;
const OPACITY_FROM = 0.35;
const OPACITY_TO = 0.7;

interface SkeletonBlockProps {
  width: number | `${number}%`;
  height: number;
  /** 생략하면 높이의 절반 — 막대는 알약 모양, 정사각형은 원이 된다 */
  radius?: number;
  /**
   * 블록 색. 기본은 흰색이다 — 인트로처럼 **색이 깔린 배경** 위에서 반투명하게 비치는 용도다.
   * 흰 카드 위에 놓을 때는 보이지 않으므로 회색 계열을 넘겨야 한다.
   */
  color?: string;
  /** 깜빡임. 값이 오지 않는 빈 자리에는 false를 넘긴다 */
  pulse?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonBlock({ width, height, radius, color = '#ffffff', pulse = true, style }: SkeletonBlockProps) {
  // 렌더 중 ref 접근을 피하려고 지연 초기화 useState로 만든다(Toast.tsx와 같은 이유)
  const [opacity] = useState(() => new Animated.Value(pulse ? OPACITY_FROM : 1));

  useEffect(() => {
    // 깜빡이지 않는 블록은 색을 그대로 보여준다. 반투명하게 두면 카드 배경과 섞여 색이 흐려진다
    if (!pulse) {
      opacity.setValue(1);
      return;
    }

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: OPACITY_TO, duration: PULSE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: OPACITY_FROM, duration: PULSE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [opacity, pulse]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius ?? height / 2,
          backgroundColor: color,
          opacity,
        },
        style,
      ]}
    />
  );
}
