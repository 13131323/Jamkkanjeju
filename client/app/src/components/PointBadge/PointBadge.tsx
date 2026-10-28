import { Text, View } from 'react-native';
import { POINT_BADGE_SIZE_STYLES, PointBadgeSize } from './styles';

interface PointBadgeProps {
  text: string;
  /**
   * 크기 프리셋. 색만 다른 게 아니라 높이·패딩·폰트가 함께 달라서 size로 묶는다.
   * - md: CultureMission "+10P" (h28 / SemiBold 14)
   * - sm: 보물찾기 "찾은 보물 n/3" (h24 / Medium 12)
   * - chip: 온보딩 결과 캐릭터 칩 (높이 고정 없이 패딩으로 결정 / SemiBold 12)
   */
  size?: PointBadgeSize;
  backgroundColor?: string;
  textColor?: string;
  /** 지정하지 않으면 테두리를 그리지 않는다 */
  borderColor?: string;
}

/**
 * 알약 모양 배지. 문화미션 포인트, 보물찾기 진행 카운트, 온보딩 캐릭터 칩이 모두 같은 형태라
 * 한 컴포넌트로 쓴다.
 *
 * 기본값은 CultureMission_detail_1 > PointBadge 기준이다:
 * 56x28 r100, bg #ecf9fd, "+10P" 14/600 #076c8d, 좌 10 / 우 12.
 * 디자인의 #82c34a 테두리는 요청에 따라 제외된 상태라 borderColor 기본값도 없음으로 둔다.
 */
export function PointBadge({
  text,
  size = 'md',
  backgroundColor = '#ecf9fd', // primary-50
  textColor = '#076c8d', // primary-800
  borderColor,
}: PointBadgeProps) {
  const sizeStyle = POINT_BADGE_SIZE_STYLES[size];

  return (
    <View
      className="flex-row items-center"
      style={[
        sizeStyle.container,
        { backgroundColor },
        // borderWidth를 항상 켜두면 테두리 없는 배지가 1px씩 커진다. 색이 있을 때만 그린다
        borderColor ? { borderWidth: 1, borderColor } : null,
      ]}
    >
      <Text numberOfLines={1} style={[sizeStyle.text, { color: textColor }]}>
        {text}
      </Text>
    </View>
  );
}
