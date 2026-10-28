import { StyleSheet } from 'react-native';

/**
 * 시트 윗변의 기울기 높이. Penpot 두 판의 윗변이 200↔240 사이를 오가므로 40이다.
 * 콘텐츠 padding은 시트 상단(=200)을 기준으로 잡으므로 이 값과 무관하다.
 */
export const SHEET_SLANT = 40;

/** 그림자가 시트 위로 번지는 여유. blur 12(stdDeviation 6)면 6~12 정도라 16을 둔다 */
export const SHEET_SHADOW_PAD = 16;

export const inviteSheetBackdropStyles = StyleSheet.create({
  // 시트 영역을 그대로 덮는다. 그림자가 위로 삐져나가야 해서 overflow는 건드리지 않는다
  container: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  band: { position: 'absolute', left: 0, right: 0, top: -SHEET_SHADOW_PAD },
  body: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: SHEET_SLANT,
    bottom: 0,
    backgroundColor: '#ffffff',
  },
});
