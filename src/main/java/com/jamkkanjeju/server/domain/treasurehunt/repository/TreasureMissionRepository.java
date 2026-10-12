package com.jamkkanjeju.server.domain.treasurehunt.repository;

import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TreasureMissionRepository extends JpaRepository<TreasureMission, Long> {

    /**
     * 결과: 활성 상태가 {@code status}이고 장소가 연결된 보물찾기 미션 전체 목록. 장소가 없는 미션은 제외된다.
     * 각 원소는 {@code mission.missionType}(유형·이름·단계)과 {@code location}(장소명·좌표)이 함께 로딩되어 있고,
     * 해당하는 미션이 없으면 빈 목록이다.
     * 사용: 홈 조회({@code GET /api/v2/users/me/home}) 응답의 {@code missionRecommend} 중 TREASURE 추천 후보.
     * 사용자가 완료한 미션을 뺀 뒤 요청 위치에서 가장 가까운 한 건을 고른다.
     */
    @EntityGraph(attributePaths = {"mission.missionType", "location"})
    List<TreasureMission> findAllByStatusAndLocationIsNotNull(MissionActivationStatus status);
}
