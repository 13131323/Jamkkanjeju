import { Image, ImageSourcePropType, Modal, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Button } from '@/components/Button/Button';
import { SuccessSparkles } from './SuccessSparkles';

/** Penpot "성공" / "실패" / "힌트" 프레임 */
export type QuizResultVariant = 'success' | 'fail' | 'hint';

interface QuizResultModalProps {
  visible: boolean;
  variant: QuizResultVariant;
  /**
   * 배지 문구. fail "남은 기회 1회" / hint 힌트 본문.
   * 생략하면 배지를 그리지 않는다 — 성공 모달은 포인트 칩을 띄우지 않는다.
   */
  badgeText?: string;
  onConfirm: () => void;
}

/**
 * 세 프레임의 카드 구조가 같다.
 * 카드 312x(369~373) r24, 패딩 상 32 / 좌우 24 / 하 24, 간격 12 → 8 → 24,
 * 일러스트 151x151, 제목 24/36 Bold, 버튼 264x52.
 * 일러스트, 제목 색, 배지 스타일, 버튼 문구만 다르다.
 */
const VARIANTS: Record<
  QuizResultVariant,
  {
    illustration: ImageSourcePropType;
    title: string;
    titleColor: string;
    confirmText: string;
    badge: ViewStyle;
    badgeText: TextStyle;
  }
> = {
  success: {
    illustration: require('@assets/images/quiz-result-success.png'),
    title: '정답이에요!',
    titleColor: '#076c8d',
    confirmText: '다음 문제',
    // 83x30: 텍스트 14/22 + 상하 4 + 좌우 10
    badge: {
      alignSelf: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: '#c5edfa',
      backgroundColor: '#ecf9fd',
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeText: { fontFamily: 'Pretendard-Regular', fontSize: 14, lineHeight: 22, color: '#076c8d' },
  },
  fail: {
    illustration: require('@assets/images/quiz-result-fail.png'),
    title: '아쉽지만 오답이에요',
    titleColor: '#e04444',
    confirmText: '다시 풀기',
    // 113x32: 텍스트 16/24 + 상하 4 + 좌우 14
    badge: {
      alignSelf: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: '#ffcece',
      backgroundColor: '#feebeb',
      paddingHorizontal: 14,
      paddingVertical: 4,
    },
    badgeText: { fontFamily: 'Pretendard-Regular', fontSize: 16, lineHeight: 24, color: '#e04444' },
  },
  hint: {
    illustration: require('@assets/images/quiz-result-hint.png'),
    title: '힌트를 확인해보세요',
    titleColor: '#111111',
    confirmText: '문제로 돌아가기',
    // 224x32: 힌트만 카드 폭에 맞춰 늘어나고(좌우 20 인셋) 모서리가 8
    badge: {
      alignSelf: 'stretch',
      marginHorizontal: 20,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#c6c6c6',
      backgroundColor: '#efefef',
      paddingHorizontal: 14,
      paddingVertical: 4,
    },
    badgeText: {
      textAlign: 'center',
      fontFamily: 'Pretendard-Regular',
      fontSize: 16,
      lineHeight: 24,
      color: '#4e4e4e',
    },
  },
};

export function QuizResultModal({ visible, variant, badgeText, onConfirm }: QuizResultModalProps) {
  const config = VARIANTS[variant];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onConfirm}>
      {/* 오버레이 #000000 55% */}
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <View
          className="items-center"
          style={{
            width: 312,
            borderRadius: 24,
            backgroundColor: '#ffffff',
            paddingTop: 32,
            paddingHorizontal: 24,
            paddingBottom: 24,
            // 디자인: 검정 15%, y 8, blur 24
            shadowColor: '#000000',
            shadowOpacity: 0.15,
            shadowOffset: { width: 0, height: 8 },
            shadowRadius: 24,
            elevation: 8,
          }}
        >
          {/* 디자인은 151x151 정사각 박스에 cover. png도 같은 비율로 잘라 두어 그대로 채운다.
              성공 프레임의 반짝이 장식은 png가 아니라 별도 도형이라 위에 덧그린다 */}
          <View style={{ width: 151.5, height: 151 }}>
            <Image source={config.illustration} style={{ width: 151, height: 151 }} resizeMode="cover" />
            {variant === 'success' && <SuccessSparkles />}
          </View>

          <Text
            style={{
              marginTop: 12,
              alignSelf: 'stretch',
              textAlign: 'center',
              fontFamily: 'Pretendard-Bold',
              fontSize: 24,
              lineHeight: 36,
              color: config.titleColor,
            }}
          >
            {config.title}
          </Text>

          {badgeText ? (
            <View style={[{ marginTop: 8 }, config.badge]}>
              <Text style={config.badgeText}>{badgeText}</Text>
            </View>
          ) : null}

          <View style={{ marginTop: 24, alignSelf: 'stretch' }}>
            <Button color="primary" bold text={config.confirmText} onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
