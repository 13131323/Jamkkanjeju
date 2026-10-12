package com.jamkkanjeju.server.domain.culturemission.repository;

import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CultureMissionRepository extends JpaRepository<CultureMission, Long> {

    /**
     * 결과: 활성 상태가 {@code status}인 문화 미션 전체 목록. 각 원소는 {@code mission.missionType}(유형·이름·단계)이
     * 함께 로딩되어 있고, 해당하는 미션이 없으면 빈 목록이다.
     * 사용: 홈 조회({@code GET /api/v2/users/me/home}) 응답의 {@code missionRecommend} 중 CULTURE 추천 후보.
     * 이 목록에서 무작위로 한 건을 고른다.
     */
    @EntityGraph(attributePaths = "mission.missionType")
    List<CultureMission> findAllByStatus(MissionActivationStatus status);
}
