/**
 * 협동 미션 흐름 추적 로그.
 *
 * 이 흐름은 **여러 사람·여러 요청·폴링이 얽혀 있어** 화면만 보고는 어디서 끊겼는지 알 수 없다.
 * "다음을 눌렀는데 아무 일도 없다"가 배정 실패인지, 단계 저장 실패인지, 단계는 올랐는데
 * 화면 이동이 안 된 것인지 구분하려면 경계마다 흔적이 남아야 한다.
 *
 * 개발 빌드에서만 찍는다. 배포 빌드에서는 호출 자체가 아무 일도 하지 않는다.
 */
export function coopTrace(label: string, detail?: Record<string, unknown>): void {
  if (!__DEV__) return;
  console.log(`[coop] ${label}`, detail === undefined ? '' : JSON.stringify(detail));
}
