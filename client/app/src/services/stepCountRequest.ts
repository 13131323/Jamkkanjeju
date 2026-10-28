import type { GeneratedApi } from '@packages/shared';
import type { StepRecord } from './stepSyncService';

/**
 * 걸음 수 저장 요청 바디 변환.
 *
 * 전송(stepCountSender)과 따로 둔 이유: sender는 생성된 API를 import하고 그 체인이
 * axios → react-native까지 이어져서, vitest(플레인 node, Metro 트랜스폼 없음)에서
 * import하는 순간 react-native의 Flow 구문을 파싱하지 못해 죽는다.
 * 이 파일은 **런타임 import가 없다**(둘 다 `import type`이라 컴파일 시 지워진다) —
 * 그래서 테스트에서 그대로 불러올 수 있다.
 */

/**
 * 로컬 레코드 → 요청 바디.
 *
 * 필드명이 서로 다르다(date→recordedDate, steps→stepsCount). 순수 함수로 떼어 둔 이유는
 * 이 매핑을 틀려도 타입이 잡아주지 못하고(둘 다 string/number) 서버 400으로만 드러나기 때문이다.
 *
 * date는 stepCounterService의 getTodayKST와 같은 KST `YYYY-MM-DD` 형식이고,
 * syncUnsentRecords가 `date < today`만 골라 보내므로 스펙이 금지하는 미래 날짜는 넘어가지 않는다.
 */
export function toStepCountRequest(record: StepRecord): GeneratedApi.StepCountSaveRequest {
  return { recordedDate: record.date, stepsCount: record.steps };
}
