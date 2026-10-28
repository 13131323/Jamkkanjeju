import type { ArCharacterColorFamily } from './types';

// 서버 characterColor → 화면 색상 계열. 값이 없거나(획득 전 등) 모르는 값이면 기본값 orange(vibrantOrange)로 둔다(기획 요청).
const COLOR_FAMILY_BY_CHARACTER_COLOR: Record<string, ArCharacterColorFamily> = {
  yellow: 'sunnyYellow',
  green: 'tertiary',
  blue: 'primary',
  grey: 'warmNeutral',
  grey1: 'warmNeutral',
  grey2: 'coolNeutral',
  orange: 'vibrantOrange',
};

export function resolveArCharacterColorFamily(characterColor: string | null | undefined): ArCharacterColorFamily {
  return (characterColor ? COLOR_FAMILY_BY_CHARACTER_COLOR[characterColor] : undefined) ?? 'vibrantOrange';
}
