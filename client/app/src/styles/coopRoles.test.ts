import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  StyleSheet: {
    create: <T>(styles: T) => styles,
  },
}));

import { coopRolesStyles } from './coopRoles';

describe('step2 role list layout', () => {
  // 헤더가 스크롤 안으로 들어가면서 좌우·위 여백은 스크롤 내용 컨테이너가 준다.
  // 헤더가 자기 여백을 또 가지면 두 번 겹친다.
  it('leaves outer spacing to the scroll container', () => {
    const header = (coopRolesStyles as unknown as Record<string, Record<string, unknown>>).selectionSectionHeader;

    expect(header).toEqual({ marginBottom: 10 });
  });

  it('starts the scrollable role cards 16px below the fixed header', () => {
    const content = (coopRolesStyles as unknown as Record<string, Record<string, unknown>>).selectionListContent;

    expect(content).toMatchObject({
      paddingBottom: 16,
      paddingHorizontal: 20,
      paddingTop: 16,
    });
  });
});
