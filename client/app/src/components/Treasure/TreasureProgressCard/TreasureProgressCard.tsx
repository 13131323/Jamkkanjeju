import { Image, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { TREASURE_MARKER_ICON } from '@/constants/treasureHunt';
import { treasureProgressCardStyles as styles } from './styles';

interface TreasureProgressCardProps {
  /** 찾은 보물 개수 */
  foundCount: number;
  /** 찾아야 하는 전체 개수 */
  totalCount: number;
  /** step0은 '#111111', step2는 카메라가 비쳐야 해서 'rgba(0,0,0,0.7)' */
  backgroundColor: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * 찾은 보물 개수 프로그래스바. Penpot TreasureHunt_step0 "Frame 530".
 * prompt §9 '그 밑에는 찾은 보물 개수를 나타내는 프로그래스바'
 */
export function TreasureProgressCard({ foundCount, totalCount, backgroundColor, style }: TreasureProgressCardProps) {
  // totalCount가 0인 데이터가 들어와도 NaN 폭을 만들지 않는다
  const ratio = totalCount > 0 ? Math.min(1, foundCount / totalCount) : 0;

  return (
    <View style={[styles.card, { backgroundColor }, style]}>
      <View
        style={styles.progressTrack}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: totalCount, now: foundCount }}
      >
        <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
      </View>

      <View style={styles.countGroup}>
        <Image source={TREASURE_MARKER_ICON} style={styles.countIcon} resizeMode="contain" />
        <Text style={styles.countText}>{`${foundCount}/${totalCount}`}</Text>
      </View>
    </View>
  );
}
