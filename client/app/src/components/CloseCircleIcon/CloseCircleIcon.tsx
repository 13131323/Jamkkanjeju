import Svg, { Circle, Path } from 'react-native-svg';

/**
 * 원 테두리 안의 X. **닫기 버튼은 앱 전체가 이 하나를 쓴다.**
 *
 * 협동 미션 공유 시트(시안 `ShareBottomSheetContainer`)의 닫기 아이콘이 원본이고,
 * 미션 중단 모달이 따로 그리던 민무늬 X를 이것으로 합쳤다(사용자 지시) —
 * 같은 화면 흐름에서 닫기 아이콘이 두 모양이면 어느 쪽이 맞는지 알 수 없다.
 *
 * 크기·선 두께는 시안 실측값(20x20 / 1.5)이다. `size`를 키워도 viewBox가 늘어나므로
 * 선 굵기 비율은 유지된다.
 */
export const CLOSE_CIRCLE_ICON_SIZE = 20;
export const CLOSE_CIRCLE_ICON_COLOR = '#463f36';

interface CloseCircleIconProps {
  size?: number;
  color?: string;
}

export function CloseCircleIcon({ size = CLOSE_CIRCLE_ICON_SIZE, color = CLOSE_CIRCLE_ICON_COLOR }: CloseCircleIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      {/* r을 9.25로 두는 이유: 선이 중앙 정렬이라 10이면 테두리 바깥쪽 절반이 잘린다 */}
      <Circle cx={10} cy={10} r={9.25} stroke={color} strokeWidth={1.5} />
      <Path d="M7.2 7.2l5.6 5.6M12.8 7.2l-5.6 5.6" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}
