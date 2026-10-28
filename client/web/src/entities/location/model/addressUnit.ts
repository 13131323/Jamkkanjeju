/**
 * 홈 상단에 보여줄 주소를 행정 단위까지만 남긴다.
 *
 * 카카오 Geocoder는 도로명("제주특별자치도 제주시 문연로 6") 또는
 * 지번("제주특별자치도 제주시 이도이동 1234-5") 전체 주소를 준다. 그대로 쓰면 번지·건물번호까지
 * 붙어 길이가 위치마다 크게 달라지고, 한 줄 라벨이라 옆 요소가 밀려 UI가 흔들린다.
 *
 * 그래서 읍/면/동(없으면 구/시/군) 토큰까지만 남기고 뒤를 버린다 — 길이가 행정구역 이름 범위로
 * 묶여 흔들리지 않는다.
 */

/**
 * 남길 마지막 토큰의 접미사.
 *
 * 우선순위가 있다: 읍/면/동이 있으면 거기까지, 없으면(도로명 주소) 구/시/군까지.
 * '리'는 읍/면 뒤에 한 단계 더 붙는 단위라 넣지 않는다 — 넣으면 "…읍 …리"까지 남아 다시 길어진다.
 */
const PRIMARY_SUFFIXES = ['읍', '면', '동'] as const;
const FALLBACK_SUFFIXES = ['구', '시', '군'] as const;

function lastIndexWithSuffix(tokens: string[], suffixes: readonly string[]): number {
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    if (suffixes.some((suffix) => tokens[index].endsWith(suffix))) return index;
  }
  return -1;
}

/**
 * @param address Geocoder가 준 전체 주소. 빈 값이면 그대로 돌려준다.
 *
 * 뒤에서부터 찾는 이유: "제주시 이도이동"처럼 시와 동이 함께 있을 때 더 좁은 단위(동)까지 남겨야 한다.
 * 앞에서 찾으면 "제주시"에서 끊겨 동이 사라진다.
 *
 * 접미사를 하나도 못 찾으면(예상 밖 형식) 자르지 않고 원본을 준다 — 주소를 통째로 잃는 것보다 낫다.
 */
export function toAddressUnit(address: string): string {
  const tokens = address.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return address;

  const primary = lastIndexWithSuffix(tokens, PRIMARY_SUFFIXES);
  const cutIndex = primary !== -1 ? primary : lastIndexWithSuffix(tokens, FALLBACK_SUFFIXES);
  if (cutIndex === -1) return address;

  return tokens.slice(0, cutIndex + 1).join(' ');
}
