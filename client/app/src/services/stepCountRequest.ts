import type { GeneratedApi } from '@packages/shared';
import { toKstTimestamp } from '@/utils/kstTimestamp';
import type { StepRecord } from './stepSyncService';

/**
 * 걸음 수 저장 요청 바디 변환.
 *
 * 전송(stepCountSender)과 따로 둔 이유: sender는 생성된 API를 import하고 그 체인이
 * axios → react-native까지 이어져서, vitest(플레인 node, Metro 트랜스폼 없음)에서
 * import하는 순간 react-native의 Flow 구문을 파싱하지 못해 죽는다.
 * 이 파일의 런타임 import는 kstTimestamp(순수 TS)뿐이라 테스트에서 그대로 불러올 수 있다.
 */

/**
 * 로컬 레코드의 KST 날짜를 그 날의 **마지막 순간**으로 옮긴다.
 *
 * 스펙이 `recordedAt`을 "걸음 수를 측정한 시각"으로 정의하는데(예전 `recordedDate`는 날짜였다),
 * 우리가 보내는 값은 **그 날 하루의 최종 누적치**다. 그래서 그 날의 끝을 가리키는 것이 맞다.
 *
 * `new Date()`(지금)를 쓰면 안 된다. syncUnsentRecords는 **어제 이전** 레코드만 고르므로,
 * 지금 시각을 찍으면 어제의 걸음 수가 오늘 측정된 것으로 저장된다.
 *
 * 형식은 toKstTimestamp와 같은 "offset 없는 KST ISO 8601"이다 — 서버가 tzinfo가 붙은 값을
 * 400으로 거절한다(kstTimestamp.ts 주석). 여기서 형식 규칙을 두 벌 갖지 않으려고 그 함수를
 * 그대로 쓴다: 날짜의 KST 자정에서 1초를 빼면 같은 날 23:59:59가 된다.
 */
function toDayEndKst(date: string): string {
  const kstMidnightUtcMs = Date.parse(`${date}T00:00:00.000Z`) - 9 * 60 * 60_000;
  return toKstTimestamp(new Date(kstMidnightUtcMs + 24 * 60 * 60_000 - 1000));
}

/**
 * 로컬 레코드 → 요청 바디.
 *
 * 필드명이 서로 다르다(date→recordedAt, steps→stepsCount). 순수 함수로 떼어 둔 이유는 이 매핑을
 * 틀려도 타입이 잡아주지 못하고(둘 다 string/number) 서버 400으로만 드러나기 때문이다.
 *
 * **`isGoalAchieved`는 아직 판정하지 않는다 — 자리표시자로 false를 보낸다.**
 * 목표는 앱에 상수로 없고 사용자마다 다르다(마이페이지에서 5000/8000/10000 중 선택,
 * `UserInfoResponse.targetStepCount`). 그 값을 가져와 비교하는 일은 **별도 작업으로 분리돼
 * 다른 담당자가 맡는다.** 타입상 필수 필드라 생략할 수 없어 값만 채워 둔 것이고, 여기서 임의의
 * 기본 목표를 지어내면 그 숫자가 그대로 달성 기록이 된다.
 *
 * 그때까지의 영향을 숨기지 않자면: 서버는 이 값을 **다시 검증하지 않는다**(생성 타입 주석 —
 * "목표 달성 여부도 프론트가 판정해서 보내고, 서버는 이 값을 저장하거나 걸음 수로 다시 검증하지
 * 않는다"). 그래서 실제로 목표를 넘긴 날도 미달성으로 저장되고 달성 보상이 지급되지 않는다.
 */
export function toStepCountRequest(record: StepRecord): GeneratedApi.StepCountSaveRequest {
  return { recordedAt: toDayEndKst(record.date), stepsCount: record.steps, isGoalAchieved: false };
}
