import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  StyleSheet: {
    create: <T>(styles: T) => styles,
  },
}));

import { MISSION_ALREADY_COMPLETE_CHARACTER_TOP, missionAlreadyCompleteStyles } from './styles';

/**
 * Penpot "TreasureHunt-detail-complete"(360x800)의 세로 좌표.
 *
 * 코드는 상태바를 insets.top으로 받으므로 디자인 y와 직접 비교할 수 없다.
 * 대신 "상태바 44 + 코드가 쌓은 값"이 디자인 y와 같은지를 확인한다 — 이 합이 맞아야
 * 시트·캐릭터가 디자인 자리에 앉는다. 값 하나만 고쳐도 여기서 깨진다.
 */
const DESIGN_STATUS_BAR = 44;
const DESIGN_HEADER_HEIGHT = 56;
const DESIGN_TITLE_BLOCK_Y = 118;
const DESIGN_TITLE_BLOCK_HEIGHT = 84;
const DESIGN_SHEET_Y = 265;
const DESIGN_CHARACTER_Y = 90;
const DESIGN_CHARACTER_SIZE = 217;

const styles = missionAlreadyCompleteStyles as unknown as Record<string, Record<string, number>>;

describe('완료 화면 세로 좌표 체인', () => {
  it('타이틀 블록이 디자인 y=118에 온다', () => {
    expect(DESIGN_STATUS_BAR + styles.header.height + styles.titleBlock.marginTop).toBe(DESIGN_TITLE_BLOCK_Y);
    expect(styles.header.height).toBe(DESIGN_HEADER_HEIGHT);
  });

  it('타이틀 블록 높이가 Frame 711의 84가 된다 — 타이틀 48 + rowGap 8 + 배지 28', () => {
    const height = styles.title.lineHeight + styles.titleColumn.gap + styles.completedBadge.height;

    expect(height).toBe(DESIGN_TITLE_BLOCK_HEIGHT);
    // 캐릭터가 없는 미션은 titleColumn 없이 titleBlock의 gap을 쓴다 — 같은 값이어야 한다
    expect(styles.titleBlock.gap).toBe(styles.titleColumn.gap);
  });

  it('흰 시트가 디자인 y=265에 온다', () => {
    const sheetY = DESIGN_STATUS_BAR + styles.header.height + styles.titleBlock.marginTop + DESIGN_TITLE_BLOCK_HEIGHT + styles.sheet.marginTop;

    expect(sheetY).toBe(DESIGN_SHEET_Y);
  });

  it('캐릭터가 디자인 y=90에서 시작하고 아래쪽이 시트에 덮인다', () => {
    expect(DESIGN_STATUS_BAR + MISSION_ALREADY_COMPLETE_CHARACTER_TOP).toBe(DESIGN_CHARACTER_Y);
    expect(styles.characterImage.width).toBe(DESIGN_CHARACTER_SIZE);
    expect(styles.characterImage.height).toBe(DESIGN_CHARACTER_SIZE);
    // 217 중 90~265의 175만 보인다. 겹치지 않으면 흐름 밖으로 뺄 이유가 없어진다
    expect(DESIGN_CHARACTER_Y + DESIGN_CHARACTER_SIZE).toBeGreaterThan(DESIGN_SHEET_Y);
  });

  it('캐릭터는 흐름 밖에 있어야 시트를 밀지 않는다', () => {
    expect(missionAlreadyCompleteStyles.characterImage.position).toBe('absolute');
    // 왼쪽으로 16 물려 나가는 것도 디자인 값이다(image 64 x=-16)
    expect(styles.characterImage.left).toBe(-16);
  });

  it('장식 원이 Ellipse 34 실측과 같다', () => {
    expect(styles.circle).toMatchObject({ left: -35, top: -14, width: 431, height: 431 });
    // 정원이어야 한다 — 지름의 절반
    expect(styles.circle.borderRadius).toBe(styles.circle.width / 2);
  });
});
