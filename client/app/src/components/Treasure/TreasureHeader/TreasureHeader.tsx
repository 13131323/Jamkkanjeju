import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationHeader } from '@/components/NavigationHeader/NavigationHeader';

interface TreasureHeaderProps {
  onBack: () => void;
  /**
   * 뒤로가기 모양. 기본은 원 배경이 있는 카메라·촬영 쪽이고, 지도(step0/step1)는 'plain'이다.
   *
   * 예전에는 네 화면을 원 있는 쪽으로 통일했는데, 지도 화면은 배경이 밝은 지도라서 원이 없어야
   * 디자인과 맞는다. 화면마다 다른 이유가 목업 편차가 아니라 배경 차이였다.
   */
  backVariant?: 'plain' | 'circle';
}

/**
 * 보물찾기 플로우 공용 헤더.
 *
 * Penpot에서 네 프레임의 헤더를 확인하면 뒤로가기 버튼이 두 종류로 갈려 있다:
 *   - TreasureHunt_step0 / step1: Back 16,16 24x24 — 아이콘만
 *   - TreasureHunt_step2 / step3: Back 16,12 32x32 → back-button 32x32 `#f6f5f4` r=16 + chevron 20x20
 * 한때 원이 있는 쪽으로 통일했지만, 지도 화면(step0/step1)에는 원 배경이 없어야 맞다 —
 * 그래서 호출부가 backVariant로 고른다(기본은 카메라·촬영의 원 있는 쪽).
 *
 * 네 프레임 모두 헤더는 0,44 360x56이고 제목·우측 요소가 없다 —
 * 진행도는 헤더 배지가 아니라 Frame 530(진행도 카드)이 담당한다.
 *
 * 상단 안전영역까지 이 컴포넌트가 먹인다. 화면마다 `paddingTop: insets.top`을 다시 적는 대신
 * 한 곳에서 처리해 네 화면의 헤더 위치가 어긋나지 않게 한다.
 */
export function TreasureHeader({ onBack, backVariant = 'circle' }: TreasureHeaderProps) {
  const insets = useSafeAreaInsets();

  // 배경을 두지 않는다 — 지도·카메라 위에 그대로 얹히고, 절대배치가 필요한 화면은 호출부가 감싼다
  return (
    <View style={{ paddingTop: insets.top }}>
      <NavigationHeader title="" onBack={onBack} backVariant={backVariant} />
    </View>
  );
}
