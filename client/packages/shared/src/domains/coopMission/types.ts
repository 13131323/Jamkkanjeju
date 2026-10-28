import type {
  CooperativeMissionStartResponse,
  CooperativeMissionStatusResponse,
  JoinCooperativeMissionResponse,
  ParticipantResponse,
  RoleCardResponse,
  RoleProgressResponse,
} from '../../api/generated';

/**
 * 협동 미션 방 타입.
 *
 * **손으로 쓰지 않고 생성 타입에 별명만 붙인다.** 예전에는 설계 시점의 계약을 여기 옮겨 적었는데,
 * 서버가 계약을 바꾼 뒤(`isHost` → `participantRole`, `locationToFind` 문자열 → 배열,
 * `inviteUrl` → `teamToken`) 두 벌이 조용히 어긋났다. 어긋난 쪽은 컴파일이 통과해서
 * 화면에서만 틀린 값이 보였다. 이제 계약의 출처는 orval 생성물 하나뿐이고,
 * 이 파일은 화면 코드가 부르기 쉬운 짧은 이름만 제공한다.
 */

/** 참여자 한 명. 아직 수락 전인 참여 요청(`PENDING`)도 포함된다 */
export type Participant = ParticipantResponse;

/** 모든 협동 미션이 공통으로 쓰는 역할 카드 */
export type RoleCard = RoleCardResponse;

/** 누가 어떤 역할을 맡아 어디까지 했는지 */
export type RoleProgress = RoleProgressResponse;

/** POST /cooperative-missions/{missionId}/progress — 201 신규 / 200 이어하기 */
export type StartCoopMissionResponse = CooperativeMissionStartResponse;

/** GET /cooperative-missions/{missionProgressId}/progress — 2초 폴링 대상 */
export type CoopMissionProgressResponse = CooperativeMissionStatusResponse;

/** POST /cooperative-missions/join-requests — 201 신규 요청 / 200 기존 참여자 */
export type JoinCoopMissionResponse = JoinCooperativeMissionResponse;
