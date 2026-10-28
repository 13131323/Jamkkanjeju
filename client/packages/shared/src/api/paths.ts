/**
 * API 경로 단일 출처.
 *
 * 경로 문자열을 web/app 양쪽에 하드코딩하면 접두사가 바뀔 때 한쪽만 고쳐지는 사고가 난다.
 * 접두사는 여기 한 곳(API_PREFIX)에서만 붙인다.
 */

/** 모든 엔드포인트 공통 접두사 */
export const API_PREFIX = '/api/v1';

const withPrefix = <T extends string>(path: T) => `${API_PREFIX}${path}` as const;

export const API_PATHS = {
  users: {
    /** PATCH: 온보딩 선택값 저장 / 조회 */
    me: withPrefix('/users/me'),
  },
  cooperativeMissions: {
    /** POST: 방 생성 · 이어하기(201 신규 / 200 기존) */
    progress: (missionId: number) => withPrefix(`/cooperative-missions/${missionId}/progress`),
    /** GET: 방 상태 조회(폴링) */
    progressDetail: (missionProgressId: number) => withPrefix(`/cooperative-missions/${missionProgressId}/progress`),
    // 초대 조회(`/invitations/{inviteToken}`)·게스트 참여 확정·미션 중단·역할 사진 인증 경로가
    // 여기 있었는데 전부 지웠다. 설계 시점 계약의 잔재로, **대응하는 엔드포인트가 없다** —
    // 초대는 `POST /cooperative-missions/join-requests`(teamToken)로, 인증은
    // `POST .../role-progresses/{id}/verification`으로 바뀌었다.
    // 실제 경로는 orval 생성 클라이언트가 들고 있으므로 여기 다시 적지 않는다.
  },
} as const;
