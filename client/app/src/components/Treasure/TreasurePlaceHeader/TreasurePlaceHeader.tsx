import { Pressable, Text, View } from 'react-native';
import { useSinglePress } from '@/hooks/useSinglePress';
import { treasurePlaceHeaderStyles as styles } from './styles';

interface TreasurePlaceHeaderProps {
  /** 장소명. 디자인 예시 "서귀포시 성산읍 오조포구" */
  placeName: string;
  /**
   * "장소 상세보기" 탭 — 장소 상세 화면으로 이동한다.
   *
   * 넘기지 않으면 배지를 그리지 않는다. 보물찾기 시작 응답의 location에는 장소 id가 없어서
   * (locationTitle·lat·lng뿐) 열 곳을 특정할 수 없는 경우가 있다 — 완료 화면이 다음 장소 id가
   * 없을 때 카드를 누를 수 없게 두는 것과 같은 처리다(app/mission/complete.tsx).
   */
  onDetailPress?: () => void;
}

/**
 * step0 지도 위 장소 헤더. Penpot TreasureHunt_step0 "Frame 538".
 * prompt §9 '"장소 상세보기" 클릭하면 해당 장소 상세 페이지로 이동'
 */
export function TreasurePlaceHeader({ placeName, onDetailPress }: TreasurePlaceHeaderProps) {
  // 훅은 조건부로 호출할 수 없어 핸들러가 없을 때도 no-op으로 감싼다
  const handleDetailPress = useSinglePress(onDetailPress ?? (() => undefined));

  return (
    <View style={styles.row}>
      <Text numberOfLines={1} style={styles.name}>
        {placeName}
      </Text>
      {onDetailPress && (
        <Pressable onPress={handleDetailPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${placeName} 상세보기`} style={styles.detailBadge}>
          {/* 디자인 배지에는 방향 표시가 없다 — 한때 chevron을 얹었지만 걷어냈다 */}
          <Text style={styles.detailBadgeText}>장소 상세보기</Text>
        </Pressable>
      )}
    </View>
  );
}
