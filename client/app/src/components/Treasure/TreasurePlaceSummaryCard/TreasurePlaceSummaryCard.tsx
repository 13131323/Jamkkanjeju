import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { TREASURE_PLACE_GUIDE_ICON } from '@/constants/treasureHunt';

/**
 * 장소 소개 카드. Penpot TreasureHunt_step0 > "Frame 539" (16,703 / 328x74).
 * prompt §9 '그 아래에는 최대 글자수 20자인 "장소" 한 줄 소개 제공' —
 * 20자로는 장소를 설명하지 못해 두 줄까지 보여주는 것으로 넓혔다.
 *
 * 자르는 일은 이 카드가 한다 — numberOfLines={2}로 두 줄을 채우고 넘치면 "…"를 붙인다.
 * 호출부는 자르지 않은 **전문**을 넘긴다(toPlaceDescription). 글자 수로 미리 잘라 넘기면
 * 눌러 펼쳐 봐야 더 나올 것이 없다.
 */
/**
 * 카드 높이(px). Penpot Frame 539 = 328x74.
 *
 * 고정 height가 아니라 minHeight로 둔다 — 문구가 두 줄이 되면 22x2 + 세로 패딩 28 = 72라
 * 74 안에 들어오지만, 폰트 배율을 키운 기기에서까지 74로 못박으면 두 번째 줄이 잘린다.
 * 토스트가 이 카드를 비켜 가는 계산(useTreasureDistanceToast)이 이 값을 기준으로 삼는다.
 */
export const TREASURE_PLACE_SUMMARY_CARD_HEIGHT = 74;

/** 카드와 화면 아래 사이 여백(px). 디자인 y=703 + 74 = 777, 화면 800 → 23에서 안전영역을 뺀 값 */
export const TREASURE_PLACE_SUMMARY_BOTTOM_GAP = 7;

/** 접은 상태의 줄 수. 디자인 Frame 539가 두 줄까지를 담는다 */
const COLLAPSED_MAX_LINES = 2;

/**
 * 펼친 상태의 줄 수 상한.
 *
 * 제한을 풀면 TourAPI 설명이 긴 장소에서 카드가 지도를 통째로 덮는다. 8줄이면
 * 22x8 + 세로 패딩 28 = 204로 화면(800)의 4분의 1 정도에서 멈추고, 그래도 넘치는 만큼은
 * 접은 상태와 같이 "…"로 자른다.
 */
const EXPANDED_MAX_LINES = 8;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: TREASURE_PLACE_SUMMARY_CARD_HEIGHT,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    // 그림자(shadow*/elevation)를 걸지 않는다. Android는 elevation을 뷰 **뒤**에 그리는데
    // 배경이 반투명(0.7)이라 그 그림자가 카드를 통과해 비친다 — 가장자리(패딩 자리)만 진해지고
    // 가운데는 옅어져 카드 안에 색이 다른 띠가 생긴다. 배경색 하나로 전체를 균일하게 둔다.
  },
  // 배경을 따로 깔지 않는다. 새 에셋(treasure-place-icon.png)이 42x42 정사각 안에 연한 하늘색
  // (#ecf9fd) 타일까지 함께 그려 갖고 있다. 여기서 또 배경을 주면 이미지가 딱 맞지 않는 순간
  // (폰트 배율·리사이즈)에 이미지 둘레로 색 띠가 생겨 테두리처럼 보인다.
  icon: {
    width: 42,
    height: 42,
  },
  text: {
    flexShrink: 1,
    color: '#ffffff',
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    lineHeight: 22,
  },
});

interface TreasurePlaceSummaryCardProps {
  summary: string;
  style?: StyleProp<ViewStyle>;
  /**
   * 실제로 그려진 카드 높이(px)를 알린다.
   *
   * 카드 위에 뜨는 거리 안내 토스트가 이 값을 기준으로 자리를 잡는다. 상수
   * (TREASURE_PLACE_SUMMARY_CARD_HEIGHT)는 minHeight일 뿐이라 문구가 두 줄이 되거나 폰트 배율이
   * 커지면 실제 높이가 그보다 크고, 그때 상수로 계산한 토스트는 카드를 덮는다.
   * 눌러서 펼친 동안에도 같은 콜백이 늘어난 높이를 알려 토스트가 함께 밀려 올라간다.
   */
  onHeightChange?: (height: number) => void;
}

export function TreasurePlaceSummaryCard({ summary, style, onHeightChange }: TreasurePlaceSummaryCardProps) {
  /**
   * 펼쳐 둔 소개 문구. 지금 문구와 같을 때만 펼친 것으로 본다 —
   * 다음 보물로 넘어가 장소가 바뀌면 effect 없이도 접힌 상태에서 다시 시작한다.
   */
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null);
  /** 카드가 bottom 고정이라 펼쳐서 늘어난 높이만큼 위로 커진다 */
  const isExpanded = expandedSummary === summary;

  function handleLayout(event: LayoutChangeEvent) {
    onHeightChange?.(event.nativeEvent.layout.height);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
      accessibilityLabel={isExpanded ? '장소 소개 접기' : '장소 소개 전체 보기'}
      onPress={() => setExpandedSummary(isExpanded ? null : summary)}
      style={[styles.card, style]}
      onLayout={onHeightChange === undefined ? undefined : handleLayout}
    >
      <Image source={TREASURE_PLACE_GUIDE_ICON} style={styles.icon} resizeMode="contain" />
      {/* 두 줄을 채운 뒤 넘치는 만큼만 "…"로 자른다. 글자 수로 미리 자르면 두 줄이 차기도 전에
          잘려서 카드 아래쪽이 비어 보인다 — 어디서 줄이 넘어가는지는 RN이 실제로 재야 안다.
          key로 Text를 새로 만들어, 줄 수를 바꿨을 때 안드로이드가 이전 높이를 들고 있지 않게 한다 */}
      <Text
        key={isExpanded ? 'summary-expanded' : 'summary-collapsed'}
        numberOfLines={isExpanded ? EXPANDED_MAX_LINES : COLLAPSED_MAX_LINES}
        ellipsizeMode="tail"
        style={styles.text}
      >
        {summary}
      </Text>
    </Pressable>
  );
}
