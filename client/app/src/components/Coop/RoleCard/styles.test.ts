import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  StyleSheet: {
    create: <T>(styles: T) => styles,
  },
}));

import { roleCardStyles } from './styles';

describe('role card visual states', () => {
  it('can render a role icon without a circular ring', () => {
    const plainAvatar = (roleCardStyles as Record<string, Record<string, unknown>>).avatarPlain;

    expect(plainAvatar).toMatchObject({
      borderRadius: 0,
      borderWidth: 0,
    });
  });

  it('can remove the card border from teammate accordions', () => {
    const borderless = (roleCardStyles as Record<string, Record<string, unknown>>).cardBorderless;

    expect(borderless).toMatchObject({
      borderWidth: 0,
    });
  });

  // 점선 구분선(DashedLine)을 대체한 실선이다. 둘이 같이 살아나면 선이 겹친다.
  it('separates an expanded header from its accordion with a solid warm hairline', () => {
    const divided = (roleCardStyles as Record<string, Record<string, unknown>>).headerRowDivided;

    expect(divided).toMatchObject({
      borderBottomColor: '#cfc8c0',
      borderBottomWidth: 1,
      paddingBottom: 8,
    });
  });

  // 구분선 아래 10 → 원래의 "헤더 아래 18"(패딩 8 + 선 1 + 10)을 유지한다
  // 시안(assets/images/1.png)에서 펼친 내용은 카드 배경 위에 그대로 얹힌다.
  // 패널이 자체 배경을 가지면 카드 안에 색이 다른 상자가 하나 더 생긴다.
  // marginTop은 headerRowDivided.paddingBottom과 같아야 한다 — 구분선 위아래 여백이 같아야 하므로.
  it('leaves the accordion panel transparent so the card ground shows through', () => {
    const contents = (roleCardStyles as Record<string, Record<string, unknown>>).contents;

    expect(contents).toEqual({ marginTop: 8 });
  });

  it('keeps the selected highlight to the border only', () => {
    const selected = (roleCardStyles as Record<string, Record<string, unknown>>).cardSelected;

    // 배경까지 덮으면 내 역할 카드가 cardMine보다 진해진다
    expect(selected).not.toHaveProperty('backgroundColor');
    expect(selected).toMatchObject({ borderColor: '#f2d21e' });
  });
});

describe('accordion divider spacing', () => {
  it('keeps the same gap above and below the divider line', () => {
    const s = roleCardStyles as Record<string, Record<string, unknown>>;

    // 선을 사이에 둔 여백이 다르면 선이 한쪽으로 붙어 보인다
    expect(s.contents.marginTop).toBe(s.headerRowDivided.paddingBottom);
  });
});
