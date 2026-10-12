package com.jamkkanjeju.server.domain.treasurehunt.repository;

import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TreasureMissionProgressRepository extends JpaRepository<TreasureMissionProgress, Long> {

    /**
     * 결과: 사용자({@code userId})의 보물찾기 진행도 전체 목록(진행 중·완료 모두). 미션당 최대 한 건이다.
     * 각 원소는 {@code treasureMission.mission.missionType}(유형·이름·단계)과 {@code treasureMission.location}
     * (장소명·좌표, 없으면 null)이 함께 로딩되어 있고, 진행도가 없으면 빈 목록이다.
     * 사용: 홈 조회({@code GET /api/v2/users/me/home}) 응답에서 두 곳에 쓴다.
     * {@code progressMission}의 TREASURE 항목은 IN_PROGRESS인 진행도로 구성하고,
     * {@code missionRecommend}의 TREASURE 후보에서는 완료한 진행도의 미션을 제외한다.
     */
    @EntityGraph(attributePaths = {"treasureMission.mission.missionType", "treasureMission.location"})
    List<TreasureMissionProgress> findAllByUserId(Long userId);
}
