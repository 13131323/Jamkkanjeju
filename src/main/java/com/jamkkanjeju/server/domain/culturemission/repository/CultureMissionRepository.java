package com.jamkkanjeju.server.domain.culturemission.repository;

import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 문화 미션을 조회하는 레포지토리이다.
 * 결과: 상속받은 {@code findById(missionId)}는 공통 미션 ID와 같은 ID의 문화 미션 한 건이며
 * 연관 엔티티는 함께 로딩하지 않고, 없으면 빈 {@code Optional}이다.
 * 사용: {@code findById(missionId)}는 문화 미션 시작/이어하기({@code POST /api/v2/culture-missions/{missionId}/progress})에서
 * 요청한 미션을 확인하는 데 쓰고, 없으면 {@code CULTURE_MISSION_NOT_FOUND}, 비활성이면 {@code CULTURE_MISSION_INACTIVE}로 처리한다.
 */
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
