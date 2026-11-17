/** 서버의 KST 시각을 기기 시간대로 변환하지 않고 공지에 표시한다. */
export function formatMaintenancePeriod(startsAt: string, endsAt: string): string {
  const startDate = startsAt.slice(5, 10).replace('-', '/');
  const endDate = endsAt.slice(5, 10).replace('-', '/');
  const startTime = startsAt.slice(11, 16);
  const endTime = endsAt.slice(11, 16);
  const end = startsAt.slice(0, 10) === endsAt.slice(0, 10) ? endTime : `${endDate} ${endTime}`;
  return `${startDate} ${startTime} ~ ${end}`;
}
