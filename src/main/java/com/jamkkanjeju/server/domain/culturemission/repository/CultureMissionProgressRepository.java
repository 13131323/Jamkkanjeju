package com.jamkkanjeju.server.domain.culturemission.repository;

import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CultureMissionProgressRepository extends JpaRepository<CultureMissionProgress, Long> {

    /**
     * 결과: 사용자({@code userId})의 문화 미션 진행도 중 진행 상태가 {@code missionStatus}인 목록.
     * 각 원소는 {@code cultureMission.mission.missionType}(유형·이름)이 함께 로딩되어 있고, 없으면 빈 목록이다.
     * 사용: 홈 조회({@code GET /api/v2/users/me/home}) 응답의 {@code progressMission} 중 CULTURE 항목.
     * IN_PROGRESS로 조회하며, {@code currentStep}은 각 진행도의 {@code currentQuizIndex}를 쓴다.
     */
    @EntityGraph(attributePaths = "cultureMission.mission.missionType")
    List<CultureMissionProgress> findAllByUserIdAndMissionStatus(Long userId, MissionProgressStatus missionStatus);
}
