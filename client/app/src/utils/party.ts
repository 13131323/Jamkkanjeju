import { MAX_PARTY_SIZE, PARTICIPANT_ROLE, PARTICIPANT_STATUS, type Participant } from '@packages/shared';

/**
 * 협동 미션 방 상태를 읽는 순수 로직.
 *
 * 방장도 수락 여부도 **서버가 정한다**(`participantRole` · `participantStatus`).
 * 클라이언트는 계산하지 않고 읽기만 한다 — 독자적으로 계산하면 서버 판단과 어긋날 수 있고,
 * 어긋났을 때 어느 쪽이 맞는지 알 수 없다.
 *
 * 예전에는 서버에 승인 대기 상태가 없어 클라이언트가 `acceptedParticipantIds`를 들고
 * 수락 여부를 판정했다. 지금은 서버가 `PENDING | ACCEPTED`를 주므로 그 목록은 사라졌다.
 */

/** 수락이 끝난 참여자만. 정원 계산과 "참여 멤버 (n/6)"의 기준 */
export function activeParticipants(participants: Participant[]): Participant[] {
  return participants.filter((p) => p.participantStatus === PARTICIPANT_STATUS.ACCEPTED);
}

/**
 * 방장.
 *
 * 수락 대기 중인 사람은 방장이 될 수 없으므로 ACCEPTED 안에서만 찾는다.
 */
export function findHost(participants: Participant[]): Participant | null {
  return activeParticipants(participants).find((p) => p.participantRole === PARTICIPANT_ROLE.HOST) ?? null;
}

export function isHost(participants: Participant[], myParticipantId: number | null): boolean {
  if (myParticipantId === null) return false;
  return findHost(participants)?.participantId === myParticipantId;
}

/**
 * 방 생성·이어하기 응답만으로 **내 참여자 id를 단정할 수 있는 경우**.
 *
 * `CooperativeMissionStartResponse`에는 `currentParticipant`가 없다 — 상태 조회 응답에만 있다
 * (`CooperativeMissionStatusResponse.currentParticipant`, 서버가 Bearer 토큰으로 식별해 준다).
 * 그래서 이 응답에서 "나"를 알아내는 유일하게 참인 경우는 **참여자가 한 명뿐일 때**다.
 * 그 한 명이 나가 아닐 수가 없다(내가 부른 요청의 응답이고, 그 방의 참여자는 그 한 명뿐이다).
 *
 * 예전에는 `findHost(...)`로 방장을 곧 나라고 봤다. 그 추측은 두 곳을 동시에 망가뜨렸다:
 *   - **멤버가 이어하기로 들어오면 자기를 방장으로 오인한다.** 초대 칩·수락/거절·"다음"이
 *     멤버에게 열리고, `myRoleProgress`가 방장의 역할을 "나의 역할"로 그린다.
 *   - 승계 판정이 동어반복이 된다 — `myParticipantId`를 방장으로 정해 두고 "방장이 나인가"를
 *     물으면 언제나 참이라, 쉬었다 돌아온 사람에게 "방장이 변경되었어요"가 늘 떴다.
 *
 * 알 수 없을 때는 null을 돌려준다. 첫 폴링(최대 2초)이 `currentParticipant`로 확정해 주므로
 * 그동안 "나" 강조와 방장 전용 UI가 잠깐 비는 것이, 남을 나로 오인하는 것보다 낫다.
 */
export function soleParticipantId(participants: Participant[]): number | null {
  if (participants.length !== 1) return null;
  return participants[0].participantId;
}

export function canInviteMore(participants: Participant[]): boolean {
  return activeParticipants(participants).length < MAX_PARTY_SIZE;
}

/**
 * 폴링 응답 사이에서 "내가 새 방장이 됐다"를 판정한다.
 *
 * 폴링은 같은 응답을 반복해서 주므로 변화 감지가 틀리면 토스트가 매 주기마다 뜨거나
 * 아예 뜨지 않는다. 그래서 이전 응답과의 비교로만 판단한다.
 *
 * prev가 null인 첫 폴링은 변화로 보지 않는다 — 방에 들어온 순간
 * "방장이 되었어요"가 뜨면 안 된다.
 *
 * **두 시점의 방장 신원을 비교한다.** 예전 규칙은 `!isHost(prev, me) && isHost(next, me)`였는데,
 * 그 앞부분이 "이전 목록에 방장이 없다"까지 참으로 만든다 — 즉 **방장을 모르던 상태**를
 * "내가 방장이 아니었다"로 읽는다. 그래서 목록이 비어 있다가 채워지는 순간마다 승계로 잡혔다:
 *
 *   - 홈의 "이어서 진행"으로 초대 화면에 들어오면 화면이 스스로 `reset()`을 부른 뒤 이어하기를
 *     보낸다. 그 사이 참여자 목록이 빈 배열이 되고 스냅샷도 빈 배열로 갱신된다. 응답이 도착해
 *     방장(=나)이 목록에 나타나는 순간 옛 규칙은 참이 됐다 — **혼자 하는 미션에서도**
 *     "방장이 퇴장하여 방장이 변경되었어요"가 떴다(기기에서 확인된 증상).
 *   - 심사위원용 모드에서는 그 빈 구간이 가짜 팀원 3명(전원 MEMBER)으로 채워져 방장이 없는
 *     목록이 되므로 결과가 같다.
 *
 * 승계는 "방장이 A였는데 지금은 나"다. 양쪽 시점 모두 방장을 알아야 말할 수 있으므로,
 * 어느 한쪽이라도 방장이 없으면 판정하지 않는다.
 */
export function becameHost(prev: Participant[] | null, next: Participant[], myParticipantId: number | null): boolean {
  if (prev === null || myParticipantId === null) return false;

  const before = findHost(prev);
  const after = findHost(next);
  // 한쪽이라도 방장을 모르면 "바뀌었다"고 말할 근거가 없다(방을 여는 중이거나 4단계 응답이다)
  if (before === null || after === null) return false;
  // 같은 사람이 계속 방장이면 승계가 아니다 — 폴링이 같은 값을 반복해도 여기서 걸린다
  if (before.participantId === after.participantId) return false;

  return after.participantId === myParticipantId;
}

/** 수락이 끝났는지. 방장 수락 전에는 `PENDING`이다 */
export function isParticipantReady(participant: Participant): boolean {
  return participant.participantStatus === PARTICIPANT_STATUS.ACCEPTED;
}

/** 방장의 수락을 기다리는 참여자. 이 사람들의 카드에만 "거절 / 수락"이 붙는다 */
export function pendingParticipants(participants: Participant[]): Participant[] {
  return participants.filter((p) => p.participantStatus === PARTICIPANT_STATUS.PENDING);
}

/**
 * 전원이 준비 완료인지. step1의 "다음" 활성 조건이다.
 *
 * 대기 중인 참여자를 남긴 채 다음 단계로 넘어가면 그 사람의 수락 여부를 확인할 화면이
 * 더 이상 없다 — 수락 UI는 step1에만 있다.
 *
 * 참여자가 아무도 없는 상태는 "전원 준비 완료"로 보지 않는다. 방장 자신이 항상
 * ACCEPTED로 들어 있으므로 실제로는 빈 목록이 나오지 않지만, 응답이 비어 온 순간
 * 다음 단계로 넘어가 버리면 원인을 찾기 어렵다.
 */
export function allParticipantsReady(participants: Participant[]): boolean {
  if (participants.length === 0) return false;
  return pendingParticipants(participants).length === 0;
}

/**
 * 미션을 시작할 수 있는 최소 인원.
 *
 * 예전에는 2명이었는데 1명으로 바뀌었다(사용자 지시). 방장 혼자서도 시작할 수 있으므로
 * 인원 조건은 사실상 항상 참이지만, 최소 인원이 다시 바뀔 때 고칠 자리가 한 곳이어야 해서 남긴다.
 */
export const MIN_PARTY_SIZE = 1;

/**
 * "다음"(= 역할 배정 시작 / "다시 역할 나누기")을 **막고 있는 것**. `'none'`이면 누를 수 있다.
 *
 * 불리언 대신 이유를 돌려주는 이유는 하나다 — **화면이 왜 잠겼는지 말해야 하기 때문이다.**
 * 버튼만 잠그고 이유를 알리지 않으면 사용자에게는 또 하나의 막다른 길이 된다(실기기에서
 * 2단계에 굳은 방이 정확히 그랬다). 판정과 문구가 같은 값을 보게 두면 둘이 어긋날 수 없다.
 *
 *   - `'not-host'` — **"다음"은 방장만 누른다**(사용자 지시). 그 버튼 하나가 역할 랜덤 배정과
 *     단계 이동을 함께 하므로(useCoopMission.ts의 `assignRolesAndAdvance`) 팀원도 누를 수 있으면
 *     배정이 두 번 이상 실행돼 서로 덮어써진다. 내 신원을 아직 모르는 경우도 여기 들어온다.
 *   - `'too-few'` — 수락이 끝난 멤버가 최소 인원에 못 미친다(지금은 1명이라 사실상 빈 목록뿐이다).
 *   - `'pending'` — **수락 대기자가 남아 있다.**
 */
export type CoopStartBlock = 'none' | 'not-host' | 'too-few' | 'pending';

export function coopStartBlock(participants: Participant[], myParticipantId: number | null): CoopStartBlock {
  if (!isHost(participants, myParticipantId)) return 'not-host';
  if (activeParticipants(participants).length < MIN_PARTY_SIZE) return 'too-few';
  if (!allParticipantsReady(participants)) return 'pending';
  return 'none';
}

/**
 * 초대 화면의 "다음"을 누를 수 있는지. 판정 전체는 위 `coopStartBlock`에 있다.
 *
 * ## `assigningRoles` 인자가 없어진 이유 (뜻이 뒤집혔다)
 *
 * 한동안 이 함수에는 세 번째 인자 `assigningRoles`가 있었고, 참이면 **수락 대기자 조건을
 * 건너뛰었다.** 2단계에 굳은 방에서 "다시 역할 나누기"가 영영 열리지 않는 것을 풀려던 완화인데,
 * 사용자가 확정한 규칙은 그 반대다:
 *
 * > "step2에서 재시도를 하면 그 사이에 다른 사람이 초대되어 들어왔더라도 모두 '준비 완료'가
 * >  아니면 '재시도'가 되면 안 돼. 왜냐면 '준비 완료'가 되었을 때만 step2로 넘어갈 수 있으니까"
 *
 * 근거가 그 문장 안에 있다. **2단계로 갈 수 있는 조건이 "전원 준비 완료"라면, 2단계에서 다시
 * 나누는 것도 같은 조건을 만족해야 한다** — 재시도는 "처음 배정과 같은 일을 다시 하는 것"이지
 * 예외가 아니다. 완화를 두면 배정 뒤에 들어온 사람이 **역할 없이 방에 남는다**(재시도 시점의
 * 명단으로 다시 나뉘는데 그 사람은 아직 대기자다).
 *
 * 그럼 원래 풀려던 교착은 어떻게 되는가 — **수락·거절을 열어서 푼다.** 끊긴 2단계에서는
 * 대기자 카드에 수락·거절이 그대로 붙으므로(coopStep.ts의 `coopInviteActionsOpen`) 방장이
 * 그 사람을 처리하면 이 조건이 저절로 참이 된다. 막는 쪽이 아니라 **치울 수단**을 준 것이다.
 *
 * **참여자 목록에 시뮬레이션이 섞여 있어도 규칙은 같다.** 가짜 팀원은 전원 MEMBER라 방장 판정을
 * 흔들지 않고, 2·3단계 응답에는 아예 ACCEPTED로 붙는다(coopDevSimulation.ts) — 그래서
 * 심사위원용 모드의 가짜가 재시도를 영영 막는 일은 없다. 1단계에서만 대기자로 붙는데,
 * 1단계에는 재시도 자체가 없고 방장이 수락하면 곧바로 빠진다.
 */
export function canStartCoopMission(participants: Participant[], myParticipantId: number | null): boolean {
  return coopStartBlock(participants, myParticipantId) === 'none';
}

/**
 * 이 참여자 카드에 **"거절 / 수락"을 붙이는지.**
 *
 * 세 조건을 모두 만족해야 한다 — 내가 방장이고, 남의 카드이고, 그 사람이 아직 수락 대기다.
 * 화면에 인라인으로 있던 판정을 옮겨 왔다(`canStartCoopMission`과 같은 이유로 순수 함수다).
 *
 * 그 앞에 `reviewOpen`이 하나 더 있다 — **지금이 이 조작을 열어도 되는 구간인가.** 그 판단은
 * 서버 단계와 이 기기의 진행 여부를 함께 봐야 해서 `coopStep.ts`의 `coopInviteActionsOpen`에
 * 있다(이 모듈은 참여자 목록만 읽는다). 화면은 "다음"과 이 버튼에 **같은 값**을 넘긴다 —
 * 한쪽만 열린 화면이 이번 버그의 정체였다.
 *
 * 예전에는 이 자리에 `assigningRoles`(= 서버 2단계)가 있었다. **뜻이 뒤집혔다:**
 *   - 배정이 **이 기기에서 돌고 있는 동안**에는 여전히 붙이지 않는다(사용자 지시: "step2를 할 때
 *     화면에는 이미 준비 완료된 경우만 있어야 하므로 거절/수락 버튼이 없어야 한다"). 초대 링크는
 *     계속 살아 있어 그 사이에 들어온 사람이 생기는데, 지금 수락해 봐야 역할은 누른 시점의
 *     명단으로 이미 나뉘었다.
 *   - 그러나 배정이 **끊긴 채 멈춘 2단계**에서는 붙인다. 그때는 아직 아무 역할도 나뉘지 않았고,
 *     방장이 그 대기자를 수락·거절해야 재시도가 열린다(`canStartCoopMission`).
 */
export function canReviewJoinRequest(member: Participant, participants: Participant[], myParticipantId: number | null, reviewOpen: boolean): boolean {
  if (!reviewOpen) return false;
  if (!isHost(participants, myParticipantId)) return false;
  if (member.participantId === myParticipantId) return false;
  return !isParticipantReady(member);
}

/**
 * 폴링 사이에 **내가** 방에서 빠졌는지. 방장이 나를 거절했을 때가 이 경우다.
 *
 * prev가 null인 첫 응답은 변화로 보지 않는다 — 화면에 들어온 순간 거절 안내가 뜨면 안 된다.
 * 거절은 `DELETE .../participants/{id}`라 서버가 목록에서 지우므로 "응답에 없음"이 곧 빠진 것이다.
 */
export function wasRemoved(prev: Participant[] | null, next: Participant[], myParticipantId: number | null): boolean {
  if (prev === null || myParticipantId === null) return false;

  const wasIn = prev.some((p) => p.participantId === myParticipantId);
  if (!wasIn) return false;

  return !next.some((p) => p.participantId === myParticipantId);
}

/**
 * 폴링 사이에 방에서 빠진 참여자들.
 *
 * 방장에게는 자기가 누른 거절의 결과이고, 남은 팀원에게는 폴링으로 처음 알게 되는 변화다.
 * 두 화면이 같은 문구를 띄우도록 판정을 한 곳에 둔다.
 */
export function removedParticipants(prev: Participant[] | null, next: Participant[]): Participant[] {
  if (prev === null) return [];

  return prev.filter((before) => !next.some((after) => after.participantId === before.participantId));
}

/**
 * 이번 폴링 회차의 **참여자 변화 판정을 건너뛰어야 하는지.**
 *
 * 심사위원용 모드가 실행 중에 켜지거나 꺼지면 목록이 통째로 달라진다 — 가짜 팀원 3명이
 * 한꺼번에 붙거나 빠지기 때문이다(coopDevSimulation.ts). 그 변화를 폴링 사이의 사건으로 읽으면
 * **아무도 나가지 않았는데 "○○님의 참여를 거절했어요"가 세 번 뜬다**(실기기에서 확인 — 게다가
 * 기본 모드로 돌아온 뒤라 가짜 이름이 떴다).
 *
 * 가짜를 빼고 비교하는 방법도 있었지만 그러면 **가짜 팀원을 거절했을 때의 안내가 사라진다** —
 * 그 안내의 유일한 출처가 이 변화 감지다. 그래서 모드가 바뀐 회차만 건너뛰고 스냅샷만 갈아
 * 끼운다. 없던 일을 알리는 것보다 한 회차 알리지 않는 쪽이 낫다.
 */
export function shouldSkipPartyChangeCheck(previousSimulation: boolean, simulation: boolean): boolean {
  return previousSimulation !== simulation;
}
