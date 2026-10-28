/** 하루(ms) */
const DAY_MS = 24 * 60 * 60 * 1000;

/** KST는 UTC+9 고정 오프셋이다(서머타임이 없다) */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 다음 KST 자정까지 남은 시간(ms).
 *
 * 걸음 수는 **일일** 값이라 KST 날짜가 바뀌는 순간 화면이 0으로 돌아가야 한다. 그런데 화면 값은
 * 센서 콜백으로만 갱신되므로, 자정에 사용자가 걷지 않으면 어제 숫자가 그대로 남는다
 * (앱을 백그라운드로 보냈다 돌아오면 getTodaySteps를 다시 읽어 고쳐지지만, 켜 둔 채로 자정을
 * 넘기면 고쳐지지 않는다). 그 시점을 알기 위해 남은 시간을 계산한다.
 *
 * 기기 시간대와 무관하게 KST로 계산한다 — 저장 키(getTodayKST)가 KST라 둘이 어긋나면
 * "리셋했는데 어제 행에 계속 쌓이는" 상태가 된다.
 *
 * 정확히 자정인 순간에는 0이 아니라 하루를 돌려준다. 0을 주면 타이머가 즉시 다시 걸려
 * 같은 경계에서 반복 실행된다.
 */
export function msUntilNextKstMidnight(now: number = Date.now()): number {
  // epoch는 UTC 자정에 맞춰져 있어, KST로 옮긴 뒤 하루로 나눈 나머지가 "KST 자정 이후 경과 시간"이다
  const msIntoKstDay = (now + KST_OFFSET_MS) % DAY_MS;
  return DAY_MS - msIntoKstDay;
}
