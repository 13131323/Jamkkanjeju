import { View } from 'react-native';
import Svg, { Defs, FeDropShadow, Filter, Path } from 'react-native-svg';
import { inviteSheetBackdropStyles as styles, SHEET_SHADOW_PAD, SHEET_SLANT } from './styles';

/**
 * 협동 미션 초대 화면(step1)의 흰 시트 배경.
 *
 * Penpot `TogetherMission_step1-invite-party-members`의 시트는 사각형이 아니라 **윗변이 기울어진
 * 두 장의 겹친 판**이다(Rectangle 84 / Rectangle 83, 둘 다 y=200 360x600 path).
 *   - 뒤판: 윗변 (0,200) → (360,240), 흰색 80%   → 왼쪽에서 배경이 살짝 비친다
 *   - 앞판: 윗변 (0,240) → (360,200), 흰색 100%
 * 두 윗변이 x=180 근처에서 교차해 대각선 두 개가 겹쳐 보이고, 각 판에 같은 그림자가 붙어 있다
 * (#000 12% / blur 12 / y+2).
 *
 * RN에는 clip-path가 없고 View 그림자는 사각형 외곽선만 따르므로 SVG로 그린다.
 * 기울기 구간(0~40)만 SVG로 그리고, 그 아래는 일반 View로 채운다 — 시트 높이가 화면에 따라
 * 달라져도 기울기 비율이 유지된다(`preserveAspectRatio="none"`이 세로를 늘리지 않게 하려면
 * viewBox 높이와 렌더 높이가 같아야 한다).
 */

/** 그림자가 시트 위쪽으로 번지는 만큼. blur 12면 6 남짓이라 16을 준다 */
const VIEWBOX_HEIGHT = SHEET_SLANT + SHEET_SHADOW_PAD + 4;
/** 디자인 보드 폭. 실제 폭으로 가로만 늘어나므로 대각선은 항상 모서리에서 모서리로 이어진다 */
const BOARD_WIDTH = 360;
const BAND_BOTTOM = SHEET_SLANT + 4;

export function InviteSheetBackdrop() {
  return (
    <View style={styles.container} pointerEvents="none">
      <Svg style={styles.band} width="100%" height={VIEWBOX_HEIGHT} viewBox={`0 ${-SHEET_SHADOW_PAD} ${BOARD_WIDTH} ${VIEWBOX_HEIGHT}`} preserveAspectRatio="none">
        <Defs>
          {/* Penpot drop-shadow: blur 12 ≈ stdDeviation 6 */}
          <Filter id="sheetShadow" x="-20%" y="-40%" width="140%" height="200%">
            <FeDropShadow dx="0" dy="2" stdDeviation="6" floodColor="#000000" floodOpacity="0.12" />
          </Filter>
        </Defs>

        {/* 뒤판 — 왼쪽이 높고 오른쪽으로 내려간다 */}
        <Path d={`M0,0 L${BOARD_WIDTH},${SHEET_SLANT} L${BOARD_WIDTH},${BAND_BOTTOM} L0,${BAND_BOTTOM} Z`} fill="#ffffff" fillOpacity={0.8} filter="url(#sheetShadow)" />
        {/* 앞판 — 오른쪽이 높고 왼쪽으로 내려간다 */}
        <Path d={`M0,${SHEET_SLANT} L${BOARD_WIDTH},0 L${BOARD_WIDTH},${BAND_BOTTOM} L0,${BAND_BOTTOM} Z`} fill="#ffffff" filter="url(#sheetShadow)" />
      </Svg>

      {/* 기울기 아래는 두 판이 모두 불투명 흰색이라 단색으로 채운다 */}
      <View style={styles.body} />
    </View>
  );
}
