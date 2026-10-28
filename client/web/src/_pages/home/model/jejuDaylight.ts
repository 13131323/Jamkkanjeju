// 제주(위도 약 33.5°N) 기준 월별 대략적인 일출·일몰 시각(KST, 분 단위) — 정밀 천문 계산 대신
// 배경 이미지를 낮/밤으로 가르는 용도로만 쓰는 근사치라 ±10~15분 오차를 허용한다(사용자 확인).
const JEJU_SUN_TIMES_BY_MONTH: { sunrise: number; sunset: number }[] = [
  { sunrise: 7 * 60 + 32, sunset: 17 * 60 + 44 }, // 1월
  { sunrise: 7 * 60 + 15, sunset: 18 * 60 + 12 }, // 2월
  { sunrise: 6 * 60 + 45, sunset: 18 * 60 + 35 }, // 3월
  { sunrise: 6 * 60, sunset: 19 * 60 }, // 4월
  { sunrise: 5 * 60 + 30, sunset: 19 * 60 + 25 }, // 5월
  { sunrise: 5 * 60 + 20, sunset: 19 * 60 + 45 }, // 6월
  { sunrise: 5 * 60 + 30, sunset: 19 * 60 + 45 }, // 7월
  { sunrise: 5 * 60 + 55, sunset: 19 * 60 + 20 }, // 8월
  { sunrise: 6 * 60 + 20, sunset: 18 * 60 + 40 }, // 9월
  { sunrise: 6 * 60 + 45, sunset: 18 * 60 + 5 }, // 10월
  { sunrise: 7 * 60 + 15, sunset: 17 * 60 + 40 }, // 11월
  { sunrise: 7 * 60 + 35, sunset: 17 * 60 + 35 }, // 12월
];

/**
 * KST는 UTC+9 고정이다. 한국은 서머타임을 쓰지 않아 계절에 따라 달라지지 않는다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 같은 시각을 **어디서 계산하든 같은 제주 벽시계**로 읽는다.
 *
 * `getHours()`·`getMonth()`는 **그 코드가 도는 기계의 타임존**을 따른다. 서버 렌더는 UTC에서
 * 돌고 기기는 KST라 같은 순간에도 9시간이 갈렸고, 그 값이 홈 배경(낮/밤)을 가르는 바람에
 * 서버가 그린 HTML과 기기가 그린 것이 달라 **hydration이 깨졌다**(기기에서 확인).
 *
 * 그래서 로컬 타임존 메서드를 쓰지 않는다. 타임스탬프에 +9시간을 더한 뒤 `getUTC*`로 읽으면
 * 실행 환경과 무관하게 KST 벽시계가 나온다.
 */
function jejuWallClock(now: Date): { month: number; minutesOfDay: number } {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return { month: kst.getUTCMonth(), minutesOfDay: kst.getUTCHours() * 60 + kst.getUTCMinutes() };
}

/** 제주 기준으로 지금이 일출~일몰 사이인지. 홈 배경을 낮/밤으로 가르는 데만 쓴다 */
export function isDaytimeInJeju(now: Date): boolean {
  const { month, minutesOfDay } = jejuWallClock(now);
  const { sunrise, sunset } = JEJU_SUN_TIMES_BY_MONTH[month];

  return minutesOfDay >= sunrise && minutesOfDay < sunset;
}

/**
 * 낮/밤을 **외부 스토어로** 읽는다. 렌더 중에 `new Date()`를 부르지 않기 위해서다.
 *
 * 홈은 `export const dynamic = 'force-dynamic'`(app/page.tsx)이라 요청마다 서버에서 다시
 * 그려진다. 렌더 중에 `useState(() => new Date())`처럼 직접 읽으면 서버와 기기가 각자 **다른
 * 렌더 시각**에 부르게 돼(네트워크 왕복만큼 벌어짐) 값이 어긋날 수 있다 — 외부 스토어로 빼서
 * 서버 스냅샷 한 번, 기기 스냅샷 한 번으로 시각을 고정한다.
 *
 * `useSyncExternalStore`는 서버 스냅샷으로 hydration한 뒤 곧바로 클라이언트 스냅샷으로 바꿔
 * 그린다. React가 그 교체를 아는 경로라 불일치 경고가 나지 않는다(useStepCount와 같은 방식).
 * 서버 스냅샷이 실제 KST 시각을 계산하므로(아래 getJejuDaylightServerSnapshot) 두 스냅샷은
 * 경계를 막 넘는 순간이 아니면 같은 값이라 교체가 눈에 띄지 않는다.
 */
const listeners = new Set<() => void>();

/** 경계 시각(일출·일몰)을 넘었는지 확인하는 주기. 1분이면 배경이 늦어도 1분 안에 따라온다 */
const DAYLIGHT_POLL_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;

export function subscribeJejuDaylight(listener: () => void): () => void {
  listeners.add(listener);
  // 구독자가 생길 때만 타이머를 켠다 — 홈을 떠나면 꺼진다
  timer ??= setInterval(() => listeners.forEach((notify) => notify()), DAYLIGHT_POLL_MS);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/**
 * 지금 값. 경계를 넘기 전까지 같은 boolean이라 `useSyncExternalStore`가 요구하는 안정성을 만족한다
 * (매번 새 객체를 만들면 무한 렌더가 된다 — 원시값이라 그 함정이 없다).
 */
export function getJejuDaylightSnapshot(): boolean {
  return isDaytimeInJeju(new Date());
}

/**
 * 서버 스냅샷. 홈이 `force-dynamic`이라 이 값이 **요청 시각 기준 실제 낮/밤**이고, 그대로
 * HTML에 그려진다. 기기가 곧이어 그리는 클라이언트 스냅샷과 같은 값이라(경계를 막 넘는 순간이
 * 아닌 한) 첫 페인트부터 맞는 배경이 나오고 깜빡임이 없다.
 */
export function getJejuDaylightServerSnapshot(): boolean {
  return isDaytimeInJeju(new Date());
}
