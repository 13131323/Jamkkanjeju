package com.jamkkanjeju.server.domain.culturemission.repository;

import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionRewardStatus;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionRewardStatusId;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 사용자별 문화 미션 보상 지급 여부를 조회·저장하는 레포지토리이다.
 * 결과: 상속받은 {@code findById(new CultureMissionRewardStatusId(userId, missionId))}는 해당 사용자·미션의 지급 여부 한 건이며
 * 없으면 빈 {@code Optional}(아직 아무 보상도 지급하지 않음)이다. {@code save(rewardStatus)}는 저장한 지급 여부를 돌려준다.
 * 사용: 문화 미션 진행도 저장({@code PATCH /api/v2/culture-missions/{cultureMissionProgressId}/progress})의 완료 처리에서
 * 이미 지급한 보상 항목을 후보에서 빼는 데 {@code findById}를 쓰고, 기록이 없으면 새로 만들어 {@code save}한다.
 * 이번에 지급한 항목만 응답의 {@code reward}에 담는다.
 */
public interface CultureMissionRewardStatusRepository
        extends JpaRepository<CultureMissionRewardStatus, CultureMissionRewardStatusId> {
}
