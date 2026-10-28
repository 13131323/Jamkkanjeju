import type { MissionStatus, ParticipantRole, ParticipantStatus } from '../../api/generated';

/**
 * 협동 미션 고정값.
 *
 * 서버 응답의 리터럴 값을 문자열로 흩뿌리지 않고 여기 한 곳에서만 정의한다.
 * 서버가 값을 정하는 열거형은 직접 적지 않고 생성물을 다시 내보낸다 —
 * 손으로 적어 두면 계약이 바뀌었을 때 컴파일은 통과하면서 값만 틀린다.
 */

/** 한 방에 참여할 수 있는 최대 인원. Penpot 설계 메모 "1~6명사이 참여" */
export const MAX_PARTY_SIZE = 6;

/**
 * 서버가 관리하는 협동 미션 단계.
 *
 * 화면은 이 값 그대로가 아니라 `coopScreenForStep`(app)이 정하는 3화면으로 접힌다 —
 * 역할을 랜덤 배정하게 되면서 역할 배정 화면이 없어졌고, 2·3단계가 모두 재료 찾기다.
 */
export const COOP_STEP = {
  INVITE: 1,
  ROLE_ASSIGNMENT: 2,
  MISSION: 3,
  COMPLETE: 4,
} as const;

export type CoopStep = (typeof COOP_STEP)[keyof typeof COOP_STEP];

/** 폴링을 멈추는 단계. 완료 화면에 도달하면 더 볼 변화가 없다 */
export const COOP_FINAL_STEP = COOP_STEP.COMPLETE;

/**
 * 서버 열거값.
 *
 * **생성물의 const 객체를 재export하지 않고 값을 여기 직접 적는다.** 예전에는
 * `export const PARTICIPANT_ROLE = ParticipantRole`처럼 생성물 배럴에서 가져왔는데,
 * 번들에서는 그것이 `var PARTICIPANT_ROLE = _apiGenerated.ParticipantRole`(모듈 초기화 시점의
 * **값 복사**)로 나온다. 생성물 배럴은 `export *`가 261개고 앱은 지연 로딩(`lazy=true`)이라,
 * 초기화 순서가 어긋나는 순간 `undefined`가 박힌 채 그대로 굳는다 — 나중에 값이 채워져도
 * 이미 복사한 뒤라 되살아나지 않는다.
 *
 * 리터럴로 적되 타입은 생성물에 묶어 둔다. `Record<X, X>`라서 **서버가 값을 추가하거나 이름을
 * 바꾸면 컴파일이 깨진다** — 손으로 적은 값이 계약과 어긋난 채 방치되지 않는다.
 * 같은 이유로 보물찾기 상수(`domains/treasureMission/constants.ts`)도 리터럴만 쓴다.
 */

/** 미션 진행 상태 */
export const MISSION_PROGRESS_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const satisfies Record<MissionStatus, MissionStatus>;
export type MissionProgressStatus = MissionStatus;

/** 역할 진행 상태. 미션 진행 상태와 같은 열거형을 쓴다 */
export const ROLE_PROGRESS_STATUS = MISSION_PROGRESS_STATUS;
export type RoleProgressStatus = MissionStatus;

/** 참여 상태. 초대 링크로 요청하면 `PENDING`, 방장이 수락하면 `ACCEPTED` */
export const PARTICIPANT_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
} as const satisfies Record<ParticipantStatus, ParticipantStatus>;
export type { ParticipantStatus };

/** 참여자 역할. 방을 만든 사람이 `HOST` */
export const PARTICIPANT_ROLE = {
  HOST: 'HOST',
  MEMBER: 'MEMBER',
} as const satisfies Record<ParticipantRole, ParticipantRole>;
export type { ParticipantRole };

/**
 * 다음 장소에 연결된 미션 유형.
 *
 * 서버는 대문자 열거값을 쓰고 앱/웹의 MissionType은 소문자('culture' | 'treasure' | 'coop')다.
 * 두 표기를 섞지 않도록 매핑을 여기서 제공한다.
 */
export const SERVER_MISSION_TYPE = {
  CULTURE: 'CULTURE',
  COOPERATIVE: 'COOPERATIVE',
  TREASURE: 'TREASURE',
} as const;

export type ServerMissionType = (typeof SERVER_MISSION_TYPE)[keyof typeof SERVER_MISSION_TYPE];

/** 서버 표기 → 클라이언트 표기 */
export const CLIENT_MISSION_TYPE: Record<ServerMissionType, 'culture' | 'coop' | 'treasure'> = {
  [SERVER_MISSION_TYPE.CULTURE]: 'culture',
  [SERVER_MISSION_TYPE.COOPERATIVE]: 'coop',
  [SERVER_MISSION_TYPE.TREASURE]: 'treasure',
};
