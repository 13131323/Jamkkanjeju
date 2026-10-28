import type { CoopMissionProgressResponse } from '@packages/shared';

/**
 * 협동 미션 폴링 응답을 직전 응답과 합치는 순수 로직.
 *
 * 서버는 단계마다 **필요한 값만 채우고 나머지를 `null`로 비운다**(계약 문서의 단계별 표).
 * 참여자·역할은 1~3단계에만, 보상·다음 장소는 4단계에만 내려온다. 그래서 응답을 그대로
 * 화면 상태로 덮어쓰면 4단계로 넘어가는 순간 팀원 목록과 역할이 통째로 사라진다.
 * "비어 있다"를 "없어졌다"로 읽지 않기 위해 비운 필드는 직전 값을 유지한다.
 *
 * 단, 단계 자체(`currentStep` 등 스칼라)는 언제나 next를 따른다 — 지금 어느 단계인지는
 * 서버만 알고, 여기서 옛 값을 붙들면 화면이 지난 단계에 머문다.
 */

/** 위 표에서 단계마다 비워지는 필드들. 스칼라 5개(missionProgressId·missionId·missionTitle·missionProgressStatus·currentStep)는 여기 없다 */
const CARRIED_FIELDS = ['currentParticipant', 'participants', 'roleCards', 'roleProgresses', 'completedRoleCount', 'totalRoleCount', 'reward', 'nextLocation'] as const;

type CarriedField = (typeof CARRIED_FIELDS)[number];

/**
 * 서버가 이 단계에서 이 필드를 "안 내려줬다"는 뜻인지.
 *
 * `null`(계약상 비움)과 `undefined`(키 자체가 빠짐)만 비어 있는 것으로 본다.
 * **빈 배열과 0은 값이다** — 역할 배정 전의 `[]`·`0`은 "아직 아무도 안 골랐다"는 정보이고,
 * 이것을 비움으로 취급하면 직전 역할 목록이 남아 이미 배정된 것처럼 보인다.
 */
function isAbsent(value: unknown): boolean {
  return value === null || value === undefined;
}

/**
 * 직전 응답(prev)의 값으로 이번 응답(next)의 빈 필드를 채운다.
 *
 * 채울 것이 하나도 없으면 **next를 같은 참조로** 돌려준다. 폴링은 2초마다 도는데
 * 매번 새 객체를 만들면 값이 그대로여도 화면이 통째로 다시 그려진다
 * (`app/src/store/coopParty.ts`의 pollRoles가 같은 이유로 참조를 지킨다).
 */
export function mergeCoopStatus(prev: CoopMissionProgressResponse | null, next: CoopMissionProgressResponse): CoopMissionProgressResponse {
  if (prev === null) return next;

  const filled = CARRIED_FIELDS.filter((field) => isAbsent(next[field]) && !isAbsent(prev[field]));
  if (filled.length === 0) return next;

  const merged: CoopMissionProgressResponse = { ...next };
  for (const field of filled) {
    // 필드마다 타입이 달라 인덱스 대입만으로는 좁혀지지 않는다. 값은 prev에서 그대로 옮기므로 안전하다
    (merged[field] as CoopMissionProgressResponse[CarriedField]) = prev[field];
  }
  return merged;
}
