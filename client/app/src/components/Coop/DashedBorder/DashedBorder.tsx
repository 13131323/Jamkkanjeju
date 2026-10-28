import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

/**
 * 점선 테두리·구분선을 SVG로 그린다.
 *
 * RN의 `borderStyle: 'dashed'`는 Android에서 두 가지로 어긋난다 —
 * borderRadius가 0이 아니면 실선으로 렌더되고, 한 변만 두께를 주면(`borderBottomWidth`)
 * 역시 실선으로 떨어진다. 협동 미션 디자인의 점선은 둘 다에 해당해서(업로드 박스 radius 12,
 * 역할 카드 헤더 아래 구분선) SVG로 직접 그린다. Button의 dashed 유형과 같은 이유다.
 */

const DASH_PATTERN = '6 4';

/** 부모를 꽉 채우는 점선 사각형. 부모에 position relative + 고정 높이가 있어야 한다 */
export function DashedRect({
  color,
  radius,
  height,
  strokeWidth = 1,
}: {
  color: string;
  radius: number;
  /** SVG는 퍼센트 높이를 못 받으므로 높이를 숫자로 받는다 */
  height: number;
  strokeWidth?: number;
}) {
  const inset = strokeWidth / 2;
  /**
   * 실제 폭(dp).
   *
   * `width="100%"`로는 오른쪽 변이 SVG 밖으로 `strokeWidth/2`만큼 나가 잘린다 —
   * 퍼센트에서 그 절반을 뺄 방법이 없어서 재야 한다(Button의 dashed 유형과 같은 이유).
   */
  const [width, setWidth] = useState(0);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(event) => {
        const measured = event.nativeEvent.layout.width;
        // 같은 값으로 setState를 반복하면 레이아웃 → 렌더 루프가 생긴다
        setWidth((current) => (Math.round(current) === Math.round(measured) ? current : measured));
      }}
    >
      {/* stroke가 도형 중앙에 걸리므로 사방으로 절반씩 들여 그린다. 재기 전에는 그리지 않는다 */}
      {width > 0 && (
        <Svg width={width} height={height}>
          <Rect x={inset} y={inset} width={width - strokeWidth} height={height - strokeWidth} rx={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={DASH_PATTERN} />
        </Svg>
      )}
    </View>
  );
}

/** 가로 점선 구분선 */
export function DashedLine({ color, strokeWidth = 1 }: { color: string; strokeWidth?: number }) {
  return (
    <View style={{ height: strokeWidth }}>
      <Svg width="100%" height={strokeWidth}>
        <Line x1={0} y1={strokeWidth / 2} x2="100%" y2={strokeWidth / 2} stroke={color} strokeWidth={strokeWidth} strokeDasharray={DASH_PATTERN} />
      </Svg>
    </View>
  );
}
