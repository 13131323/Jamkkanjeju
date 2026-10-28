import { useState } from 'react';
import { Image, ImageSourcePropType, LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { reverseIllustrationSize } from './illustration';
import { getSelectionCardStateStyle, SELECTION_CARD_TYPOGRAPHY, selectionCardStyles } from './styles';

interface SelectionCardProps {
  icon: ImageSourcePropType;
  title: string;
  subtitle?: string;
  selected?: boolean;
  onPress: () => void;
  iconSize?: number;
  layout?: 'vertical' | 'horizontal' | 'horizontal-reverse';
}

function CheckCircle() {
  return (
    <View style={selectionCardStyles.checkCircle}>
      <Text style={selectionCardStyles.checkText}>✓</Text>
    </View>
  );
}

export function SelectionCard({ icon, title, subtitle, selected = false, onPress, iconSize = 48, layout = 'vertical' }: SelectionCardProps) {
  const stateStyle = getSelectionCardStateStyle(selected);
  // 카드가 기기 높이에 맞춰 늘어나면 일러스트도 같은 비율로 키운다.
  // 일러스트는 absolute라 카드 높이에 영향을 주지 않으므로 측정↔레이아웃 루프가 생기지 않는다.
  const [reverseCardHeight, setReverseCardHeight] = useState(0);

  if (layout === 'horizontal-reverse') {
    const handleReverseLayout = (event: LayoutChangeEvent) => {
      setReverseCardHeight(event.nativeEvent.layout.height);
    };

    return (
      <Pressable onPress={onPress} style={[stateStyle, selectionCardStyles.reverseCard]} onLayout={handleReverseLayout}>
        <Image source={icon} style={[selectionCardStyles.reverseImage, reverseIllustrationSize(reverseCardHeight)]} resizeMode="contain" />
        <View style={selectionCardStyles.reverseText}>
          <Text style={SELECTION_CARD_TYPOGRAPHY.horizontalTitle}>{title}</Text>
          {subtitle && <Text style={[SELECTION_CARD_TYPOGRAPHY.horizontalSubtitle, selectionCardStyles.horizontalSubtitle]}>{subtitle}</Text>}
        </View>
        {selected && <CheckCircle />}
      </Pressable>
    );
  }

  if (layout === 'horizontal') {
    return (
      <Pressable onPress={onPress} style={[stateStyle, selectionCardStyles.horizontalCard]}>
        <Image source={icon} style={{ width: iconSize, height: iconSize }} resizeMode="contain" />
        <View style={selectionCardStyles.horizontalText}>
          <Text style={SELECTION_CARD_TYPOGRAPHY.horizontalTitle}>{title}</Text>
          {subtitle && <Text style={[SELECTION_CARD_TYPOGRAPHY.horizontalSubtitle, selectionCardStyles.horizontalSubtitle]}>{subtitle}</Text>}
        </View>
        {selected && <CheckCircle />}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={[stateStyle, selectionCardStyles.verticalCard]}>
      <Image source={icon} style={selectionCardStyles.verticalImage} resizeMode="contain" />
      <View style={selectionCardStyles.verticalTextBlock}>
        <Text style={[SELECTION_CARD_TYPOGRAPHY.verticalTitle, selectionCardStyles.verticalTitle]}>{title}</Text>
        {subtitle && <Text style={[SELECTION_CARD_TYPOGRAPHY.verticalSubtitle, selectionCardStyles.verticalSubtitle]}>{subtitle}</Text>}
      </View>
      {selected && <CheckCircle />}
    </Pressable>
  );
}
