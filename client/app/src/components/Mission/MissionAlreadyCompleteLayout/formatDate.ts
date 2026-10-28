/**
 * 완료 배지의 날짜 표기. Penpot quiz-mission-detail-complete의 "2026.08.25" 형식.
 *
 * toLocaleDateString은 기기 로케일에 따라 "2026. 8. 25." / "8/25/2026"으로 갈려서
 * 디자인 표기를 보장하지 못한다. 그래서 직접 조립한다.
 * 파싱할 수 없는 값이 오면 빈 문자열을 돌려 배지에 "Invalid Date"가 찍히지 않게 한다.
 */
export function formatCompletedDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}
