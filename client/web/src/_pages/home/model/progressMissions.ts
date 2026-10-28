import { COOP_STEP, type GeneratedApi } from '@packages/shared';

/** `missionType === 'COOPERATIVE'`를 문자열로 적되 오타는 컴파일에서 잡히게 한다 */
const COOPERATIVE: GeneratedApi.AppHomeSchemasMissionType = 'COOPERATIVE';

/**
 * 홈 상단 "진행중인 미션" 카드에 실제로 띄울 항목만 남긴다.
 *
 * **응답에는 상태 필드가 없다.** `ProgressMission`이 주는 것은 missionId·missionType·
 * missionTitle·장소 정보·totalStep·currentStep뿐이라(packages/shared/src/api/generated/progressMission.ts)
 * `MissionStatus.COMPLETED`로 거를 방법이 아예 없다. 스키마 설명도 "사용자가 진행 중인 미션"이라
 * 완료 건을 빼는 일은 서버 몫이다. 여기서 하는 것은 그 계약을 대신하는 필터가 아니라,
 * **계약상 진행중일 수 없는 값**만 걷어내는 안전망이다 — 완료된 미션이 카드에 남으면 눌렀을 때
 * 앱이 이미 끝난 미션의 진행 화면(resume)으로 보내진다.
 *
 * 판단의 근거는 단계의 의미가 유형마다 다르다는 것 하나다(openapi `ProgressMission` 설명,
 * "BUSINESS_RULES 5. 단계 정보"):
 *
 * - `CULTURE`     — totalStep = 퀴즈 수, currentStep = **다음에 풀 퀴즈 번호**(신규 진행도는 1.
 *   app/src/constants/cultureQuiz.ts의 `resolveResumeIndex` 주석과 같은 값이다).
 *   마지막 문제를 푸는 동안이 `3/3`이므로 `currentStep === totalStep`은 **아직 진행중**이다.
 * - `TREASURE`    — totalStep = 미션 소개 단계(step_detail) 수 = 3, currentStep = 진행도의 current_step.
 *   마이페이지의 같은 자리(`ProgressMissionResponse`)는 이 값을 "찾은 보물 수"라고 설명해 0부터 셀 수
 *   있으므로 0도 유효한 값으로 둔다. 분모는 어느 쪽이든 3이다(shared TREASURE_TARGET_COUNT).
 * - `COOPERATIVE` — totalStep = 4, currentStep = `COOP_STEP`(1 초대 · 2 역할 배정 · 3 미션 · 4 완료).
 *   **4는 완료 화면이다**(app/src/utils/coopStep.ts가 4를 complete로 보낸다). 즉 이 유형만
 *   `currentStep === totalStep`이 "끝난 미션"을 뜻한다 — 한 규칙을 세 유형에 그대로 쓰면
 *   문화 미션의 마지막 문제를 숨기거나 협동 미션의 완료 건을 남기게 된다.
 */
export function selectVisibleProgressMissions(missions: GeneratedApi.ProgressMission[]): GeneratedApi.ProgressMission[] {
  return missions.filter(isInProgress);
}

function isInProgress(mission: GeneratedApi.ProgressMission): boolean {
  const { missionType, currentStep, totalStep } = mission;

  // 분모가 없으면 "1/0" 같은 배지가 된다. 유형과 무관하게 단계가 하나는 있어야 진행중일 수 있다
  if (totalStep < 1) return false;

  // 음수는 어느 유형에서도 계약에 없는 값이다(0은 TREASURE에서 유효할 수 있어 남긴다 — 위 주석)
  if (currentStep < 0) return false;

  // 마지막 단계를 넘어섰다 = 이미 끝났다. 문화 미션이 완료되면 "다음에 풀 퀴즈 번호"가
  // 퀴즈 수를 넘어가므로 그 형태가 여기 걸린다("4/3"이 화면에 찍히는 것도 함께 막는다)
  if (currentStep > totalStep) return false;

  // 협동 미션만 마지막 단계 자체가 완료다. 분모(totalStep)가 아니라 COOP_STEP.COMPLETE로 재는 이유는
  // 이 판단이 서버가 준 단계 수가 아니라 **앱이 4를 완료 화면으로 본다는 사실**에 걸려 있기 때문이다
  if (missionType === COOPERATIVE && currentStep >= COOP_STEP.COMPLETE) return false;

  return true;
}
