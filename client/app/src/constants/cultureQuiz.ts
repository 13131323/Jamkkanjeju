/**
 * POST /api/v1/culture-missions/{cultureMissionId}/progress 응답의 문제 목록을 화면이 쓸 형태로 다듬는다.
 *
 * 서버는 정답을 번호가 아니라 문자열로 준다. 객관식도 마찬가지라 보기 문자열과 그대로 비교한다.
 */
import type { GeneratedApi } from '@packages/shared';

/** 화면에서 풀 수 있는 문제 — 보기가 있는 객관식만 남긴다 */
export interface PlayableQuiz extends GeneratedApi.QuizDetailResponse {
  options: string[];
}

/**
 * 풀 수 있는 문제만 quizIndex 순으로 추린다.
 *
 * 주관식(options: null)은 아직 대응하는 입력 화면이 없어 제외한다. 서버는 quizIndex 오름차순을
 * 보장한다고 했지만, 순서가 화면 진행과 직결되므로 여기서 한 번 더 정렬한다.
 */
export function toPlayableQuizzes(quizDetails: GeneratedApi.QuizDetailResponse[]): PlayableQuiz[] {
  return quizDetails
    .filter((quiz): quiz is PlayableQuiz => Array.isArray(quiz.options) && quiz.options.length > 0)
    .slice()
    .sort((a, b) => a.quizIndex - b.quizIndex);
}

/**
 * 이어하기 시작 위치.
 *
 * @param currentQuizNumber 서버가 준 "다음에 풀 퀴즈 번호". 신규 진행도는 1이다.
 *
 * 주관식을 걸러내면서 번호가 비므로 정확히 일치하는 문제가 없을 수 있다.
 * 그때는 그 번호 이후의 첫 문제로 넘어간다. 남은 문제가 없으면 마지막 문제에 머문다 —
 * 화면이 빈 상태가 되는 것보다 낫다.
 */
export function resolveResumeIndex(quizzes: PlayableQuiz[], currentQuizNumber: number): number {
  if (quizzes.length === 0) return 0;

  const found = quizzes.findIndex((quiz) => quiz.quizIndex >= currentQuizNumber);
  return found === -1 ? quizzes.length - 1 : found;
}

/**
 * 지금 그릴 문제의 위치.
 *
 * @param visitedIndex 사용자가 실제로 넘긴 위치. 아직 한 문제도 넘기지 않았으면 `null`이다.
 *
 * 이어하기 위치를 **파생 값**으로 만들기 위한 함수다. 예전에는 시작 응답이 도착한 뒤 effect가
 * `setCurrentIndex(resolveResumeIndex(...))`로 옮겼는데, 그러면 응답이 온 프레임에 **1번 문제와
 * "1 / N"이 먼저 그려지고** 다음 프레임에 이어할 문제로 바뀐다 — 홈의 "진행중인 미션"으로 들어온
 * 사용자에게는 이미 푼 문제가 한 번 스쳐 지나가는 것으로 보인다.
 * (보물찾기 `treasure.tsx`의 `activePhase`가 지도 한 프레임을 없애려고 쓰는 것과 같은 방식이다.)
 *
 * 한 번이라도 넘긴 뒤에는 이어하기 위치를 다시 보지 않는다 — 서버가 준 위치로 되돌아가면
 * 사용자의 진행이 덮인다.
 */
export function resolveCurrentQuizIndex(visitedIndex: number | null, quizzes: PlayableQuiz[], currentQuizNumber: number): number {
  if (visitedIndex !== null) return visitedIndex;
  return resolveResumeIndex(quizzes, currentQuizNumber);
}

/** 고른 보기가 정답인지. 서버 정답이 문자열이라 문자열끼리 비교한다 */
export function isCorrectAnswer(selectedOption: string | null, answer: string): boolean {
  if (selectedOption === null) return false;
  return selectedOption.trim() === answer.trim();
}

/**
 * 한 문제를 저장한 뒤 화면이 할 일.
 *
 * - `complete`: 서버가 미션을 끝냈다. 응답에 보상·다음 장소가 들어 있으므로 그대로 완료 화면으로.
 * - `stop`: 서버는 아직 진행 중인데 **화면에 보여 줄 문제가 남지 않았다.** 중단 요청으로 끝낸다.
 * - `next`: 다음 문제로.
 */
export type QuizAdvance = 'complete' | 'stop' | 'next';

/**
 * 저장 응답과 화면 위치로 다음 행동을 정한다.
 *
 * `stop`이 필요한 이유는 두 쪽의 "끝"이 다르기 때문이다. `toPlayableQuizzes`가 주관식을 걸러 내므로
 * 화면은 객관식만 다 풀면 끝인데, 서버는 걸러낸 문제까지 풀어야 완료로 본다. 예전에는 이 경우
 * 아무것도 하지 않아서 **마지막 문제에서 "다음"을 눌러도 화면이 그대로였다**(사용자 확인).
 *
 * 중단은 서버가 완료로 처리해 맞힌 만큼 보상과 다음 장소를 내려 주므로, 남은 주관식을 풀 방법이
 * 없는 화면에서는 그게 유일하게 말이 되는 끝맺음이다.
 */
export function resolveQuizAdvance(missionProgressStatus: string, currentIndex: number, total: number): QuizAdvance {
  if (missionProgressStatus === 'COMPLETED') return 'complete';
  return currentIndex >= total - 1 ? 'stop' : 'next';
}
