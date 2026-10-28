import { useEffect, useState } from 'react';
import { Animated, Easing, Image, type ImageSourcePropType, Modal, PanResponder, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button/Button';
import { shouldCloseOnDragRelease, shouldStartSheetDrag } from '@/constants/bottomSheetDrag';
import { PHOTO_GUIDE, PHOTO_GUIDE_SAMPLE_COUNT } from '@/constants/coopMission';
import { photoGuideSheetStyles as styles } from './styles';

/**
 * 시트가 자기 높이만큼 움직이는 데 걸리는 시간.
 *
 * 열기·닫기·드래그 후 마무리가 **같은 속도**를 쓴다. 드래그 도중에는 손가락을 그대로 따라가므로
 * 이 값이 곧 "드래그하다 손을 뗐을 때의 속도"이고, 나머지 동작을 거기에 맞췄다.
 * 부분만 내려온 상태에서 닫을 때는 남은 거리에 비례해 시간을 줄여야 속도가 같아진다(slideOut 참고).
 */
const SHEET_TRAVEL_MS = 220;
/** 열기·닫기·되돌리기가 같은 곡선을 쓴다 — 시간만 같고 곡선이 다르면 체감 속도가 어긋난다 */
const SHEET_EASING = Easing.out(Easing.cubic);

interface PhotoGuideSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** 좋은 예 / 나쁜 예 한 섹션. 라벨 → 예시 사진 3장 → 설명 카드 */
function GuideSection({
  label,
  emoji,
  color,
  image,
  description,
  cardStyle,
  descriptionStyle,
}: {
  label: string;
  emoji: string;
  color: string;
  image: ImageSourcePropType;
  description: string;
  cardStyle: object;
  descriptionStyle: object;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
        <Text style={[styles.sectionEmoji, { color }]}>{emoji}</Text>
      </View>

      <View style={styles.samples}>
        {/* 디자인의 예시는 같은 이미지 3장이다 — 서버가 역할별 예시를 주면 배열로 바뀐다 */}
        {Array.from({ length: PHOTO_GUIDE_SAMPLE_COUNT }, (_, index) => (
          <Image key={index} source={image} style={styles.sample} resizeMode="cover" />
        ))}
      </View>

      <View style={[styles.card, cardStyle]}>
        <Text style={[styles.cardText, descriptionStyle]}>{description}</Text>
      </View>
    </View>
  );
}

/**
 * 촬영 예시 시트 (Penpot `photo-example-bottomsheet`).
 *
 * 시트는 상태바 바로 아래(디자인 y=41)에서 화면 끝까지 차지하고, 잡이(handle)는 상단에 있다.
 *
 * **아래에서 올라와 열리고, 아래로 내려가며 닫힌다** — 이름 그대로의 바텀시트 동작이다
 * (사용자 확인 2026-08-27). 시트 상단(잡이·제목)을 끌어내려도 같은 닫힘 경로를 탄다.
 *
 * 닫힘을 시트가 직접 그리는 대신 부모의 visible을 먼저 내리면 Modal이 그 자리에서 사라진다.
 * 그래서 애니메이션이 끝난 뒤에 onClose를 부르고, 부모는 그때 visible을 내린다.
 */
export function PhotoGuideSheet({ visible, onClose }: PhotoGuideSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // 시트는 insets.top에서 화면 끝까지라 이 거리만 내려가면 완전히 빠진다.
  // 임의의 큰 수(예전 900)를 쓰면 화면 밖에서 애니메이션 시간을 낭비해 체감 속도가 어긋난다.
  const travel = windowHeight - insets.top;
  // useRef(...).current를 렌더 중에 읽으면 react-hooks/refs가 잡는다.
  // 지연 초기화 useState는 값을 한 번만 만들면서 렌더 중 ref 접근을 피한다(Toast와 같은 방식).
  // 첫 값은 화면 아래 밖이면 되므로 화면 높이를 그대로 쓴다(열 때 travel로 다시 맞춘다).
  const [translateY] = useState(() => new Animated.Value(windowHeight));

  // 열릴 때만 애니메이션한다. 화면 아래쪽 밖에서 제자리로 올라온다.
  useEffect(() => {
    if (!visible) return;

    translateY.setValue(travel);
    const animation = Animated.timing(translateY, {
      toValue: 0,
      duration: SHEET_TRAVEL_MS,
      easing: SHEET_EASING,
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [visible, travel, translateY]);

  /**
   * 아래로 빠지며 닫는다. 확인 버튼·스크림 탭·하드웨어 백·드래그가 모두 이 경로를 쓴다.
   *
   * fromY는 지금 시트가 내려와 있는 거리다(드래그 중이면 손가락이 끌어낸 만큼).
   * 남은 거리에 비례해 시간을 줄여야 어디서 놓아도 같은 속도로 빠진다.
   */
  const slideOut = (fromY = 0) => {
    const remaining = Math.max(0, travel - fromY);

    Animated.timing(translateY, {
      toValue: travel,
      duration: (remaining / travel) * SHEET_TRAVEL_MS,
      easing: SHEET_EASING,
      useNativeDriver: true,
    }).start(({ finished }) => {
      // 애니메이션이 끝난 뒤에 알린다. 부모가 먼저 visible을 내리면
      // Modal이 그 자리에서 사라져 내려가는 모습이 보이지 않는다.
      if (finished) onClose();
    });
  };

  /** 문턱을 못 넘겼을 때 제자리로. 되돌아가는 것도 같은 속도로 맞춘다 */
  const settleBack = (fromY = 0) => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: (Math.max(0, fromY) / travel) * SHEET_TRAVEL_MS,
      easing: SHEET_EASING,
      useNativeDriver: true,
    }).start();
  };

  // 시트 상단(잡이·제목)을 끌어내려 닫는다. 본문은 ScrollView라 여기에 붙이지 않는다 —
  // 목록을 스크롤하려는 손짓과 시트를 내리려는 손짓이 섞이면 둘 다 어색해진다.
  // gesture-handler 대신 내장 PanResponder를 쓰는 이유는 이 한 곳뿐이라 의존성을 늘릴 이유가 없다.
  const drag = PanResponder.create({
    // 터치가 내려앉는 순간 이 영역이 responder가 된다.
    // 이걸 빼고 onMoveShouldSetPanResponder만 두면 첫 움직임이 다른 뷰로 새는 경우가 있다
    // (Modal 안에서 특히). 잡이·제목은 눌러서 할 일이 없으므로 탭을 삼켜도 문제가 없다.
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) => shouldStartSheetDrag(gesture.dy, gesture.dx),
    // 드래그 중에는 다른 뷰(본문 ScrollView 등)가 제스처를 가져가지 못하게 한다
    onPanResponderTerminationRequest: () => false,
    // 위로는 끌리지 않게 0에서 자른다 — 시트가 제자리보다 올라갈 자리가 없다
    onPanResponderMove: (_event, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_event, gesture) => {
      const draggedTo = Math.max(0, gesture.dy);
      if (shouldCloseOnDragRelease(gesture.dy, gesture.vy)) {
        slideOut(draggedTo);
        return;
      }
      settleBack(draggedTo);
    },
    // 다른 곳이 제스처를 가져가면(예: 시스템 뒤로가기 스와이프) 제자리로 되돌린다
    onPanResponderTerminate: (_event, gesture) => settleBack(Math.max(0, gesture.dy)),
  });

  // 스크림은 시트가 제자리에 있을 때 가장 진하고, 아래로 내려간 만큼 함께 옅어진다
  const scrimOpacity = translateY.interpolate({
    inputRange: [0, travel],
    outputRange: [1, 0],
  });

  return (
    // slideOut은 fromY를 받으므로 이벤트 핸들러에 그대로 넘기지 않는다 —
    // 넘기면 네이티브 이벤트 객체가 fromY 자리에 들어간다
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => slideOut()} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: scrimOpacity }]}>
        <Pressable style={styles.overlayPress} onPress={() => slideOut()} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            top: insets.top,
            paddingBottom: Math.max(insets.bottom, 16) + 18,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* 이 영역만 끌어내려 닫을 수 있다 */}
        <View style={styles.dragArea} {...drag.panHandlers}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          <Text style={styles.title}>{PHOTO_GUIDE.title}</Text>
        </View>

        {/* 디자인은 한 화면에 다 들어가지만 작은 기기에서는 넘치므로 안에서만 스크롤한다 */}
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          <GuideSection
            label={PHOTO_GUIDE.bad.label}
            emoji={PHOTO_GUIDE.bad.emoji}
            color="#c53030"
            image={PHOTO_GUIDE.bad.image}
            description={PHOTO_GUIDE.bad.description}
            cardStyle={styles.badCard}
            descriptionStyle={styles.badCardText}
          />
          <GuideSection
            label={PHOTO_GUIDE.good.label}
            emoji={PHOTO_GUIDE.good.emoji}
            color="#685210"
            image={PHOTO_GUIDE.good.image}
            description={PHOTO_GUIDE.good.description}
            cardStyle={styles.goodCard}
            descriptionStyle={styles.goodCardText}
          />

          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>{PHOTO_GUIDE.tipsTitle}</Text>
            <View style={styles.tipList}>
              {PHOTO_GUIDE.tips.map((tip) => (
                <View key={tip} style={styles.tipRow}>
                  <Text style={styles.tipBullet}>•</Text>
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <Button color="cool-neutral" text={PHOTO_GUIDE.cta} onPress={() => slideOut()} />
      </Animated.View>
    </Modal>
  );
}
