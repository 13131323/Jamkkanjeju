package com.jamkkanjeju.server.domain.mission.repository;

import com.jamkkanjeju.server.domain.mission.entity.Mission;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/** 공통 미션을 조회하고 연결된 유형 정보를 제공하는 레포지토리이다. */
public interface MissionRepository extends JpaRepository<Mission, Long> {

    /**
     * 결과: 공통 미션 ID({@code missionId})의 미션 한 건이며 {@code missionType}(유형·제목·설명·단계)을
     * 함께 로딩한다. 해당 미션이 없으면 빈 {@code Optional}이다.
     * 사용: 미션 홈 조회({@code GET /api/v2/missions/{missionId}})에서 조회할 세부 미션 유형을 결정하고,
     * 응답의 {@code id}, {@code missionType}, {@code missionTitle}, {@code description}, {@code steps}를 구성한다.
     * 단계 정렬과 미션 존재 여부 판정은 서비스에서 수행한다.
     */
    @Override
    @EntityGraph(attributePaths = "missionType")
    Optional<Mission> findById(Long missionId);
}
