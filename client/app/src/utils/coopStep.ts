import { COOP_STEP, MISSION_PROGRESS_STATUS, type MissionProgressStatus } from '@packages/shared';

/**
 * 서버의 협동 미션 단계(1~4)를 실제 화면 3개로 접는다.
 *
 * 역할을 랜덤 배정하게 되면서 역할 배정 화면이 없어졌다. 그래서 서버는 여전히 4단계를 주지만
 * 앱에는 초대·재료 찾기·완료 세 화면뿐이다.
 *
 * **2단계(역할 배정)는 재료 찾기가 아니라 초대 화면에 남는다.** 예전에는 2와 3을 함께 재료
 * 찾기로 접었는데, 배정 자체가 2단계에서 일어나기 때문에 그 접기가 버그를 만들었다:
 * `assignRolesAndAdvance`는 `PATCH progress(2)` → 참여자별 `PUT role-assignments` →
 * `PATCH progress(3)` 순으로 도는데, 그 사이 2초 폴링이 **중간의 2단계를 먼저 읽어** 모두를
 * 재료 찾기로 보냈다. 그 시점 응답의 `roleProgresses`는 아직 `[]`라 "나의 역할"이 빈 화면에
 * 갇혔다(기기에서 확인). 배정이 끝나 3단계가 되어야 재료 찾기로 가는 것이 맞다.
 *
 * 팀원 화면은 폴링으로 받은 `currentStep`을 보고 방장을 따라 자동으로 이동한다.
 * 매핑이 화면마다 흩어지면 한쪽만 고쳐졌을 때 방장과 팀원이 서로 다른 화면에 남는다 —
 * 그래서 판단을 여기 한 곳에만 둔다.
 */

export type CoopScreen = 'invite' | 'materials' | 'complete';

/**
 * 서버 단계 → 화면.
 *
 * 1·2단계는 초대 화면이다(2단계 = 역할을 배정하는 중 — 위 주석 참고).
 * 계약에 없는 값(0·5·음수)과 아직 응답을 못 받은 null/undefined도 초대 화면으로 되돌린다.
 * 매핑이 없다고 아무것도 렌더하지 않으면 사용자에게는 흰 화면만 남고 되돌아갈 방법도 없다.
 */
export function coopScreenForStep(currentStep: number | null | undefined): CoopScreen {
  switch (currentStep) {
    case COOP_STEP.INVITE:
    case COOP_STEP.ROLE_ASSIGNMENT:
      return 'invite';
    case COOP_STEP.MISSION:
      return 'materials';
    case COOP_STEP.COMPLETE:
      return 'complete';
    default:
      return 'invite';
  }
}

/**
 * 지금 **역할을 배정하는 중**인지(서버 2단계).
 *
 * 이 구간에는 방장이 누른 "다음"의 후속 요청(참여자별 `PUT role-assignments`)이 아직 돌고 있다.
 * 화면은 초대 화면 그대로이므로, 그 화면의 "다음"이 활성인 채로 남으면 **배정이 두 번 돌 수 있다** —
 * 한 버튼이 배정과 단계 이동을 함께 하기 때문에(useCoopMission.ts의 `assignRolesAndAdvance`)
 * 두 번째 실행은 이미 저장된 배정을 덮어쓴다. 그래서 이 구간의 "다음"은 잠근다(together.tsx).
 *
 * 누른 사람만 아는 `isAdvancing`(뮤테이션 pending)으로는 부족하다. 그 값은 **그 기기에만** 있고,
 * 요청 사이에 잠깐 false가 되며, 앱을 껐다 켜거나 홈에서 "이어서 진행"으로 다시 들어오면
 * 아예 없다 — 그때 화면을 정하는 것은 서버가 준 단계뿐이다.
 */
export function isCoopAssigningRoles(currentStep: number | null | undefined): boolean {
  return currentStep === COOP_STEP.ROLE_ASSIGNMENT;
}

/**
 * "역할을 랜덤으로 정하고 있어요" 안내를 **지금 띄워야 하는지.**
 *
 * 조건이 둘이다 — 지금이 배정 구간이고(위 `isCoopAssigningRoles`), **이 진입에서 아직 안 띄웠다.**
 *
 * 뒤 조건이 없으면 폴링이 2초마다 같은 2단계를 돌려주므로 토스트가 도배된다. 그런데 그
 * "안 띄웠다"를 화면 안의 ref로 들면 **한 진입에 두 번 뜬다** — 홈의 "이어서 진행"은 초대 화면을
 * 두 번 마운트하기 때문이다(store/coopParty.ts의 `roleAssignNoticeShown` 주석에 그 경로가 있다).
 * 그래서 근거를 화면 밖(스토어)에서 받아 이 판정에 함께 넣는다.
 *
 * 순수 함수로 떼는 이유는 `canStartCoopMission`과 같다 — 안내가 몇 번 뜨는지는 화면을 띄우지
 * 않고도 확인할 수 있어야 하고, 실제로 여기서 회귀가 두 번 났다.
 */
export function shouldShowRoleAssignNotice(currentStep: number | null | undefined, alreadyShown: boolean): boolean {
  if (alreadyShown) return false;
  return isCoopAssigningRoles(currentStep);
}

/**
 * 배정이 **지금 돌고 있는지**, **끊긴 채 멈춰 있는지**, 아니면 **아직 알 수 없는지.**
 *
 * `isCoopAssigningRoles`만으로는 이들이 구분되지 않는다. 서버 단계가 2라는 사실은 같은데
 * 뜻이 정반대다:
 *
 *   - `'assigning'` — **이 기기가 방금 "다음"을 눌러 요청이 나가 있다.** 다시 누르면 배정이
 *     두 번 돌아 이미 저장된 역할을 덮어쓰므로 잠가야 한다.
 *   - `'stalled'` — **서버는 2단계인데 이 기기는 아무것도 하고 있지 않다.** 배정 도중에 앱을
 *     떠났거나 요청이 실패해 방이 그 단계에 굳은 것이다. 여기서도 잠그면 **앞으로 갈 수단이
 *     아예 없어진다** — 실기기에서 이어하기가 2단계에서 멈춘 것이 이 경우였다.
 *   - `'unknown'` — **아직 단계를 모른다**(상태 조회가 이 방에 대해 한 번도 응답하지 않았다).
 *   - `'idle'` — 단계를 아는데 배정 구간이 아니다(1·3·4단계).
 *
 * **`'unknown'`을 `'idle'`에서 떼어 낸 것이 이번 수정의 핵심이다.** 예전에는 단계를 모르는
 * 구간이 `'idle'`에 접혀 있었고, 화면은 그것을 **1단계로 오인해 그렸다**: `currentStep`이 null이면
 * `isCoopAssigningRoles`도 거짓이라 수락·거절이 붙고 "다음"이 열린다. 게다가 그 구간의 참여자
 * 목록은 폴링 응답이 아니라 방 생성·이어하기 응답으로 채워지는데, 심사위원용 모드에서 거기 붙는
 * 가짜 팀원은 **PENDING**이다(coopDevSimulation.ts의 `simulateParticipants` — `acceptedSimIds`가
 * 비어 있다). 그래서 2단계에 굳은 방으로 들어가도 첫 응답이 오기 전까지는 **"수락 / 거절"이 달린
 * 1단계 화면**이 그대로 보였다(실기기에서 확인된 증상 — 화면이 실제로 1단계로 간 것이 아니라
 * 같은 초대 화면에서 그 UI가 되살아난 것이다).
 *
 * 단계를 모르는 동안은 아무 조작도 열지 않는다(아래 `coopInviteActionsOpen`). 그 구간에 "다음"을
 * 누를 수 있으면 `assignRolesAndAdvance`가 **자기가 몇 단계인지도 모른 채** `PATCH progress(2)`
 * 부터 보내게 된다(useCoopMission.ts) — 이미 3단계인 방을 되돌리는 요청이다.
 *
 * 배정 중과 끊김을 가르는 근거가 **이 기기의 진행 여부**인 것이 핵심이다. 배정을 시작할 수 있는
 * 사람은 방장뿐이므로(party.ts의 `canStartCoopMission`), 방장의 기기에서 요청이 돌고 있지 않다면
 * 그 배정은 아무도 이어받고 있지 않다. 팀원 기기에서는 언제나 `'stalled'`로 보이지만 그들은
 * 애초에 이 버튼을 누를 수 없어(방장 조건) 판단에 쓰이지 않는다 — 화면은 그 구분을 함께 쓴다.
 *
 * 되살리는 요청 자체는 덮어쓰지 않는다(useCoopMission.ts의 `assignRolesAndAdvance`) —
 * 이미 배정된 사람과 이미 쓰인 카드는 건너뛰고 남은 것만 채운다.
 */
export type CoopAssignPhase = 'unknown' | 'idle' | 'assigning' | 'stalled';

export function coopAssignPhase(currentStep: number | null | undefined, inFlightOnThisDevice: boolean): CoopAssignPhase {
  // 이 기기가 요청을 보냈다는 사실이 서버 단계보다 앞선다 — 누른 직후에는 아직 1단계가 보인다
  if (inFlightOnThisDevice) return 'assigning';
  if (currentStep === null || currentStep === undefined) return 'unknown';
  return isCoopAssigningRoles(currentStep) ? 'stalled' : 'idle';
}

/**
 * 초대 화면의 **조작을 열어도 되는 구간인지** — 수락·거절과 "다음"(= "다시 역할 나누기")이
 * 같은 게이트를 쓴다.
 *
 * **둘을 하나로 묶는 것이 요점이다.** 예전에는 각자 다른 근거를 봤다 — 수락·거절은 "지금 2단계인가"
 * (`isCoopAssigningRoles`), "다음"은 그 위에 `canStartCoopMission`의 완화가 따로 얹혀 있었다.
 * 그래서 전이 중에 **한쪽만 열린 화면**이 만들어졌다: 단계를 모르는 구간에서는 수락·거절이
 * 되살아났고, 2단계에서는 대기자를 손댈 수 없는데도 "다음"만 열려 있었다. 화면이 늘 하나의 상태로
 * 보이려면 두 조작이 같은 판정을 지나야 한다.
 *
 *   - `'idle'`(1단계) — 평소의 초대 화면. 둘 다 연다.
 *   - `'stalled'`(끊긴 2단계) — 둘 다 연다. **수락·거절을 여는 것이 특히 중요하다.** 재시도는
 *     대기자가 남아 있으면 막히는데(party.ts의 `canStartCoopMission`), 그 대기자를 처리할 수단까지
 *     닫으면 방이 2단계에 영영 갇힌다.
 *   - `'assigning'` — 둘 다 닫는다. 역할은 누른 시점의 명단으로 이미 나뉘었고, 다시 누르면
 *     배정이 두 번 돈다.
 *   - `'unknown'` — 둘 다 닫는다. 모르는 단계를 1단계인 척 그리지 않는다(위 주석).
 *
 * 단계도 함께 받는 이유는 **떠나기 직전의 한 프레임** 때문이다. 배정이 성공하면 단계가 3이 되고
 * 그 순간 phase는 `'idle'`로 돌아오는데, 화면을 옮기는 것은 `useEffect`라 **커밋과 effect 사이에
 * 한 번 그려진다.** 그 프레임에서 조작을 열면, 배정이 도는 사이에 초대 링크로 들어온 사람의
 * 수락·거절이 잠깐 번쩍인다 — 그 사람은 이미 이번 배정 밖이라 눌러도 의미가 없다.
 * 이 화면의 단계가 이미 지났으면(`coopScreenAdvance`가 갈 곳을 준다) 아무것도 열지 않는다.
 */
export function coopInviteActionsOpen(phase: CoopAssignPhase, currentStep: number | null | undefined): boolean {
  if (coopScreenAdvance('invite', currentStep) !== null) return false;
  return phase === 'idle' || phase === 'stalled';
}

/**
 * 초대 화면 헤더 아래 **한 줄이 무엇을 말해야 하는지.** 문장 자체는 화면에 있다(together.tsx).
 *
 * 그 줄은 **CTA가 왜 그 모습인지를 설명하는 자리**라, 고르는 근거가 CTA와 같아야 한다.
 * 우선순위가 곧 사용자가 지금 할 수 있는 일의 순서다:
 *
 *   1. `'pending-review'` — 재시도가 **대기자 때문에** 막혔다. 할 일이 있는 유일한 경우라
 *      가장 앞에 온다. 여기서 "다시 시도해주세요"만 보이면 눌리지 않는 버튼을 계속 누르게 된다.
 *   2. `'stalled'` — 끊긴 배정을 이어받을 수 있다(방장만). 누르면 된다.
 *   3. `'assigning'` — 기다리면 된다. 배정이 이 기기에서 돌고 있거나(`'assigning'`),
 *      다른 기기가 돌리는 것을 팀원이 보고 있는 경우(`'stalled'`인데 방장이 아니다)다.
 *   4. `'ready'` — 평소의 초대 단계. "모두 준비 완료되어야 시작할 수 있어요."
 *
 * 단계를 아직 모르는 `'unknown'`도 4번으로 떨어진다. 그 구간에는 조작이 모두 닫혀 있어
 * (`coopInviteActionsOpen`) 설명할 잠금이 따로 없고, 곧 첫 응답이 진짜 상태를 정한다.
 */
export type CoopInviteNoticeKind = 'ready' | 'assigning' | 'stalled' | 'pending-review';

export function coopInviteNoticeKind(phase: CoopAssignPhase, options: { canRetryAssign: boolean; blockedByPending: boolean }): CoopInviteNoticeKind {
  if (options.canRetryAssign) return options.blockedByPending ? 'pending-review' : 'stalled';
  if (phase === 'assigning' || phase === 'stalled') return 'assigning';
  return 'ready';
}

/**
 * 화면 이동은 **앞으로만** 한다. 지금 화면과 서버 단계를 함께 보고 옮길 곳을 정한다.
 *
 * 각 화면의 단계 effect가 쓴다. `null`이면 **제자리에 머문다**는 뜻이다.
 *
 * 뒤로 가지 않는 이유가 둘이다.
 *
 * 1. **단계는 되돌아가지 않는다.** 서버는 1→2→3→4로만 올린다. 그러니 재료 찾기 화면이 2단계를
 *    읽는 경우는 배정 도중에 나간 요청이 뒤늦게 도착한 것뿐인데, 그걸 보고 초대 화면으로
 *    되돌리면 초대 화면은 곧 3단계를 읽고 다시 이리로 보낸다 — **두 화면이 서로를 밀어내며
 *    앱이 그대로 죽는다.** 예전에 실제로 그렇게 죽었고(together-materials.tsx의 그 주석),
 *    2단계를 초대 화면으로 옮기면서 그 왕복이 일어날 수 있는 자리가 늘었다.
 * 2. **단계를 모르는 동안 움직이지 않는다.** 첫 응답 전에는 `currentStep`이 null이라
 *    `coopScreenForStep`의 기본값(초대)이 나오는데, 그 기본값에 기대어 이동하면 3단계 방으로
 *    이어한 사람이 초대 화면으로 끌려간다. 두 화면이 각자 이 대기를 적어 두던 것을 여기로 모은다.
 */
const COOP_SCREEN_ORDER: readonly CoopScreen[] = ['invite', 'materials', 'complete'];

export function coopScreenAdvance(current: CoopScreen, currentStep: number | null | undefined): CoopScreen | null {
  if (currentStep === null || currentStep === undefined) return null;

  const next = coopScreenForStep(currentStep);
  if (COOP_SCREEN_ORDER.indexOf(next) <= COOP_SCREEN_ORDER.indexOf(current)) return null;
  return next;
}

/**
 * 방을 여는 요청(`POST .../{cooperativeMissionId}/progress`)의 응답이 무엇인지.
 *
 * `'already-completed'`는 **이미 끝난 진행도를 그대로 돌려받았다**는 뜻이다. 서버가 그렇게
 * 동작하는 것이 기기에서 확인됐다 — 끝난 미션으로 이어하기를 보내면 새 방을 만들지도,
 * `409 COOPERATIVE_MISSION_ALREADY_COMPLETED`를 내지도 않고 그 진행도를 그대로 준다.
 *
 * 그것을 알아내는 근거가 `missionProgressStatus`다. 시작·이어하기 응답
 * (`CooperativeMissionStartResponse`)과 상태 조회 응답 모두 이 필드를 준다(`IN_PROGRESS |
 * COMPLETED`). 문화·보물찾기가 이미 같은 필드로 완료를 판정한다(`resolveQuizAdvance`,
 * treasure.tsx) — 협동만 읽지 않고 있었다.
 *
 * **`currentStep`으로 판정하지 않는다.** 단계 4는 "완료 화면 단계"이지 "진행도가 끝났다"가
 * 아니다. 방장이 4단계로 올린 직후 쉬었다 돌아오는 경우처럼 4단계인 채 `IN_PROGRESS`인 방이
 * 있을 수 있어서, 그 둘을 섞으면 아직 안 끝난 방을 끝났다고 말하게 된다.
 *
 * 화면에 머무는 동안 폴링이 COMPLETED로 바뀌는 경우(다른 멤버가 미션을 끝냄)는 여기 해당하지
 * 않는다. 그때는 방금 함께 끝낸 미션이라 완료 화면이 맞고, 그 이동은 `currentStep` 변화를 보는
 * 각 화면의 effect가 한다. **진입 시점의 완료와 진행 중의 완료는 다른 사건이다.**
 */
export type CoopEntryOutcome = 'resume' | 'already-completed';

export function coopEntryOutcome(missionProgressStatus: MissionProgressStatus | null | undefined): CoopEntryOutcome {
  return missionProgressStatus === MISSION_PROGRESS_STATUS.COMPLETED ? 'already-completed' : 'resume';
}

/**
 * 화면 → expo-router 경로.
 *
 * 반환 타입을 `string`이 아니라 리터럴 유니온으로 좁힌다 — expo-router의 typedRoutes가
 * `Href`만 받으므로 `string`이면 호출부에서 전부 캐스팅해야 하고, 그러면 오타 난 경로가
 * 컴파일을 통과한다.
 */
const COOP_SCREEN_ROUTES = {
  invite: '/mission/together',
  materials: '/mission/together-materials',
  complete: '/mission/complete',
} as const;

export function coopRouteForScreen(screen: CoopScreen): (typeof COOP_SCREEN_ROUTES)[CoopScreen] {
  return COOP_SCREEN_ROUTES[screen];
}

/** `coopHrefForScreen`이 돌려주는 값 — 완료 화면만 파라미터를 달고 간다 */
export type CoopHref = '/mission/together' | '/mission/together-materials' | { pathname: '/mission/complete'; params: { mission: 'coop' } };

/**
 * 화면 → **실제로 넘길 Href**(파라미터 포함).
 *
 * 완료 화면만 파라미터가 필요하다. `/mission/complete`는 `mission` 파라미터로 어느 미션의 완료인지
 * 고르는데, 없으면 `resolveMissionType`이 **문화 미션으로 떨어진다**(constants/mission.ts) —
 * 협동 미션을 끝냈는데 문화 미션 완료 화면(문구·CTA·보상 행이 전부 다르다)이 뜬다.
 *
 * 경로만 주는 `coopRouteForScreen`을 호출부마다 쓰다가 `useEnterCoopRoom`이 그 파라미터를
 * 빠뜨려 실제로 그렇게 됐다(4단계 방으로 이어하거나 인트로에서 다시 들어온 경우).
 * 위 `coopScreenForStep`을 한곳에 모은 것과 같은 이유로, 파라미터까지 포함한 판단도 여기 둔다.
 */
export function coopHrefForScreen(screen: CoopScreen): CoopHref {
  if (screen === 'complete') return { pathname: COOP_SCREEN_ROUTES.complete, params: { mission: 'coop' } };
  return COOP_SCREEN_ROUTES[screen];
}

/**
 * 폴링을 계속할지.
 *
 * 완료 단계에 도달하면 더 볼 변화가 없어 멈춘다. 반대로 **아직 단계를 모를 때는 멈추지 않는다** —
 * 첫 응답이 오기 전에 폴링을 끄면 그 응답이 영영 오지 않아 화면이 초대 단계에 굳는다.
 */
export function shouldPollCoopStatus(currentStep: number | null | undefined): boolean {
  return currentStep !== COOP_STEP.COMPLETE;
}

/**
 * 방 상태 폴링 간격.
 *
 * 서버가 변경 결과를 응답에 바로 담아 주지 않아 폴링이 유일한 동기화 경로다. 참여자 이탈과
 * 방장 승계도 이 응답의 `participants`로만 알 수 있다(계약상 1~3단계에 내려온다).
 */
export const COOP_POLL_INTERVAL_MS = 2000;

/**
 * 429(Too Many Requests)를 받은 뒤의 간격.
 *
 * 2초를 그대로 유지하면 서버가 "너무 잦다"고 말하는 동안에도 같은 속도로 계속 두드린다 —
 * 그러면 제한이 풀리는 시점만 뒤로 밀린다. 멈추지 않고 늦추기만 하는 이유는, 폴링이 끊기면
 * 단계 변화를 못 받아 팀원 화면이 방장을 따라오지 못하기 때문이다.
 */
export const COOP_POLL_BACKOFF_MS = 10000;

/**
 * 지금 폴링을 얼마 간격으로 돌릴지. `false`면 돌리지 않는다.
 *
 * 세 가지를 한자리에서 정한다 — 흩어 두면 "왜 폴링이 안 도는지"를 세 곳에서 찾아야 한다.
 *
 * 1. **완료 단계**면 더 볼 변화가 없다.
 * 2. **앱이 포그라운드가 아니면** 돌리지 않는다. react-query의 `refetchIntervalInBackground`는
 *    여기서 쓸 수 없다 — RN에는 `visibilitychange`가 없어 focusManager가 이벤트를 하나도 받지
 *    못하고, `isFocused()`가 `globalThis.document?.visibilityState !== 'hidden'`으로 떨어져
 *    **항상 true**가 된다(@tanstack/query-core focusManager.js). 그래서 그 옵션을 false로 두든
 *    말든 앱을 내려 둔 동안에도 2초 폴링이 계속 돌았다. 포그라운드 여부는 호출부가 AppState로
 *    직접 읽어 넘긴다.
 * 3. **429를 받았으면** 간격을 늘린다(위 상수).
 */
export function coopPollIntervalMs(currentStep: number | null | undefined, options: { foreground: boolean; rateLimited: boolean }): number | false {
  if (!options.foreground) return false;
  if (!shouldPollCoopStatus(currentStep)) return false;
  return options.rateLimited ? COOP_POLL_BACKOFF_MS : COOP_POLL_INTERVAL_MS;
}

/**
 * 협동 미션 화면에서 미션 인트로로 되돌아가는 경로.
 *
 * **missionId를 반드시 함께 싣는다.** 인트로는 그 id로 미션 홈(`GET /api/v1/missions/COOPERATIVE/{id}`)을
 * 읽고, 거기서 누르는 "다시 시작하기"의 `POST /api/v1/cooperative-missions/{cooperativeMissionId}/progress`도
 * 그 id로 나간다. 빠뜨리면 `resolveMissionId`가 폴백 id(1)를 쓰므로 **방금까지 하던 미션이 아닌
 * 다른 협동 미션**의 방을 열게 되고, 그러면 이어하기(200)가 아니라 새 방이 1단계로 열린다 —
 * "쉬었다 왔더니 1단계"가 이렇게 만들어진다.
 *
 * 문화·보물찾기 화면은 이미 id를 실어 보낸다(culture.tsx · treasure.tsx). 협동만 빠져 있었다.
 *
 * id를 아직 모르면(폴링이 한 번도 응답하지 않았고 라우트 파라미터도 없다) 파라미터 없이 보낸다 —
 * 그때는 인트로가 폴백을 쓰지만, 인트로를 아예 못 여는 것보다는 낫다.
 * 협동에서 missionId를 주는 응답은 상태 조회뿐이다(방 생성 응답에는 그 필드가 없다).
 */
export function coopIntroRoute(missionId: number | null | undefined): { pathname: '/mission/intro'; params: { mission: 'coop'; missionId?: string } } {
  if (missionId === null || missionId === undefined) return { pathname: '/mission/intro', params: { mission: 'coop' } };
  return { pathname: '/mission/intro', params: { mission: 'coop', missionId: String(missionId) } };
}
