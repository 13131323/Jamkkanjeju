import { saveStepCountApiV1UsersMeStepCountsPut } from '@/services/api/others/others';
import { toStepCountRequest } from './stepCountRequest';
import type { StepRecordSender } from './stepSyncService';

/**
 * 걸음 수 저장 API로 실제 전송하는 sender.
 *
 * stepSyncService가 sender를 인자로 받는 구조인 이유: 그쪽은 SQLite에서 미전송 레코드를 골라
 * 순서대로 보내고 성공한 것만 synced로 표시하는 로직이고, 어디로 보내는지는 알 필요가 없다.
 * 그래서 API 의존은 이 파일에만 두고 stepSyncService 테스트는 가짜 sender로 돌린다.
 *
 * 훅이 아닌 평범한 함수(orval의 plain 함수)를 쓰는 이유: 호출부에 백그라운드 태스크
 * (services/backgroundTask.ts)처럼 React 트리 밖인 곳이 있어 훅을 쓸 수 없다.
 *
 * 요청 바디 변환은 stepCountRequest.ts에 있다 — 이 파일은 API를 import해서
 * vitest로 불러올 수 없으므로, 검증할 값이 있는 로직은 그쪽에 둔다.
 */

/** 전송 실패는 던진다 — syncUnsentRecords가 synced 표시를 건너뛰고 다음 기회에 재시도한다 */
export const sendStepRecord: StepRecordSender = async (record) => {
  await saveStepCountApiV1UsersMeStepCountsPut(toStepCountRequest(record));
};
