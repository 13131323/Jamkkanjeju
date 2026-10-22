package com.jamkkanjeju.server.domain.mission.repository;

import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatusId;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 결과: {@code findById(new MissionRewardStatusId(missionId, userId))}는 공통 미션·사용자별 지급 상태 한 건이며,
 * 없으면 빈 {@code Optional}이다. 미션과 사용자는 LAZY이며 함께 로딩하지 않는다.
 * {@code save(rewardStatus)}는 저장한 지급 상태를 반환한다.
 * 사용: 문화 미션 진행도 저장({@code PATCH /api/v2/culture-missions/{cultureMissionProgressId}/progress})과
 * 중단({@code PATCH /api/v2/culture-missions/{cultureMissionProgressId}/progress/stop})의 보상 지급 시
 * 기존 지급 항목을 제외하고 새 지급 여부를 저장한다. 실제 지급 항목으로 응답의 {@code reward}를 구성한다.
 * 미션 홈 조회({@code GET /api/v2/missions/{missionId}})에서는 같은 {@code findById}로 사용자별 지급 여부를 확인해
 * {@code remainingReward}에서 이미 지급된 항목을 null로 구성한다. 기록이 없어도 생성하거나 저장하지 않는다.
 * 보물찾기 진행도 저장({@code PATCH /api/v2/treasure-missions/{treasureMissionProgressId}/progress})에서도
 * 같은 조회·저장 메서드로 기지급 항목을 제외하고 이번 보물 발견의 지급 여부를 기록해 {@code reward}를 구성한다.
 * 협동 미션 진행도 저장({@code PATCH /api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress})에서는
 * 서비스가 참가자별 기존 완료 이력과 지급 상태를 확인하여 최초 완료 대상에게만 설정된 보상을 모두 지급한다.
 * 한 항목이라도 기지급이면 남은 항목도 추가 지급하지 않으며 실제 지급한 항목의 상태만 저장한다. 응답 본문은 없다.
 */
public interface MissionRewardStatusRepository extends JpaRepository<MissionRewardStatus, MissionRewardStatusId> {
}
