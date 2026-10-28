import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { TREASURE_MODAL_ALL_FOUND_ICON, TREASURE_MODAL_FOUND_ICON, type Treasure } from '@/constants/treasureHunt';
import { Button } from '@/components/Button/Button';
import { resolveRewardModalText, type TreasureRewardModalVariant } from './rewardModalText';
import { styles } from './styles';

interface TreasureRewardModalProps {
  /** null이면 닫힌 상태. 호출부는 찾은 보물이 있을 때만 값을 넣어 모달을 띄운다 */
  treasure: Treasure | null;
  /**
   * 어떤 상태의 모달인지. 호출부가 진행도를 보고 정한다.
   * prompt §9 "이미 클릭했던 보물은 ... 또 누를 때 모달 띄우나 다른 메시지 제공"
   */
  variant: TreasureRewardModalVariant;
  /** 보상 이름(예: "AR 캐릭터 보물이"). 설명 문구에 그대로 들어간다 */
  rewardLabel: string;
  /**
   * CTA. 'all-found'면 촬영 화면(step3)으로, 그 밖에는 획득 처리로 이어진다(호출부 책임).
   * 'already-found'는 더 받을 것이 없어 호출부가 닫기만 한다.
   */
  onConfirm: () => void;
  /** X 아이콘 탭 / 스크림 탭 — 모달만 닫는다 */
  onClose: () => void;
}

// 디자인에 없는 아이콘이라 정해진 참조가 없어 단순 X 형태로 직접 그린다
function CloseIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Line x1={2} y1={2} x2={14} y2={14} stroke="#aaaaaa" strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={14} y1={2} x2={2} y2={14} stroke="#aaaaaa" strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

/** 등장 애니메이션 길이(ms) */
const POP_MS = 380;

/**
 * 보물 획득 모달. Penpot "step-3" 열의 두 모달 보드(`재오픈`, `Container`) 기준.
 *
 * 세 가지 상태를 한 레이아웃으로 그린다 — 보드 두 장이 아이콘·문구·CTA만 다르고 나머지
 * (296x331 / r=20 / 아이콘 y=32 / 제목 y=120 / 설명 y=167 / CTA y=251)는 완전히 같다.
 * 문구 조립은 rewardModalText.ts가, 상태 판정은 호출부가 맡는다.
 *
 * 아이콘 뒤의 초록 그라디언트 원은 **그리지 않는다**. 디자인에도 88x88 원이 남아 있지만
 * `fillOpacity: 0`이라 화면에는 안 보이는 레이어다 — 보상 이미지 자체가 배경 없이 놓인다.
 *
 * prompt §9 "클릭 시, 모달 열리고, 해당 모달에서 애니메이션 제공" —
 * 보상 이미지가 튀어오르며(scale 0.6 → 1) 커지고 컨테이너는 페이드 인한다.
 */
export function TreasureRewardModal({ treasure, variant, rewardLabel, onConfirm, onClose }: TreasureRewardModalProps) {
  // 지연 초기화 useState로 Animated.Value를 만든다 — 렌더 중 ref 접근을 피한다(Toast.tsx와 같은 이유)
  const [pop] = useState(() => new Animated.Value(0));

  // 모달이 열릴 때마다(=보물이 바뀔 때마다) 처음부터 다시 재생한다
  const openedTreasureIndex = treasure?.treasureIndex ?? null;
  useEffect(() => {
    if (openedTreasureIndex === null) return;

    pop.setValue(0);
    const animation = Animated.timing(pop, {
      toValue: 1,
      duration: POP_MS,
      easing: Easing.out(Easing.back(2)),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [openedTreasureIndex, pop]);

  if (!treasure) return null;

  const imageScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const { title, description, ctaText } = resolveRewardModalText(variant, treasure.treasureIndex, rewardLabel);
  // 모두 찾은 순간에는 축하하는 캐릭터로 바뀐다(Penpot `Container` 보드의 JejuCelebrationImage)
  const icon = variant === 'all-found' ? TREASURE_MODAL_ALL_FOUND_ICON : TREASURE_MODAL_FOUND_ICON;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* 스크림 — 디자인 Rectangle 67(#000000@0.7) */}
      <Pressable style={styles.scrim} onPress={onClose}>
        {/* 내용 영역을 별도 Pressable(no-op onPress)로 감싸 탭이 바깥 스크림 onPress로 전파되지 않게 막는다 */}
        <Pressable style={styles.container} onPress={() => undefined}>
          <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8} accessibilityLabel="닫기">
            <CloseIcon />
          </Pressable>

          <Animated.View style={[styles.rewardImageWrapper, { transform: [{ scale: imageScale }] }]}>
            <Image source={icon} style={styles.rewardImage} resizeMode="contain" />
          </Animated.View>

          <View style={styles.titleWrapper}>
            <Text style={styles.title}>{title}</Text>
          </View>

          <View style={styles.descriptionWrapper}>
            <Text style={styles.description}>{description}</Text>
          </View>

          <View style={styles.ctaWrapper}>
            {/* Button의 cool-neutral/sm 조합이 디자인 값(bg #333333, 텍스트 #ffffff, height 48, radius 999)과
                정확히 일치해 별도 커스텀 스타일 없이 그대로 재사용한다 */}
            <Button color="cool-neutral" size="sm" text={ctaText} onPress={variant === 'already-found' ? onClose : onConfirm} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
