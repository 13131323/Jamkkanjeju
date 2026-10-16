package com.jamkkanjeju.server.domain.treasurehunt.repository;

import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import java.util.List;
import java.util.Optional;
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

    /**
     * 결과: 사용자({@code userId})와 공통 미션({@code missionId})에 해당하는 보물찾기 진행도 한 건이다.
     * 진행 중·완료 상태 모두 조회하며, {@code treasureMission}과 {@code treasureMission.location}을 함께 로딩한다.
     * 장소가 없으면 location은 null이고, 해당 사용자의 진행도가 없으면 빈 {@code Optional}이다.
     * 사용: 보물찾기 시작/이어하기({@code POST /api/v2/treasure-missions/{missionId}/progress})에서
     * 없으면 최초 시작, IN_PROGRESS이면 이어하기, COMPLETED이면 기존 진행도 재시작으로 분기한다.
     * 응답의 {@code treasureMissionProgressId}, {@code missionProgressStatus}, {@code location} 구성에 사용한다.
     */
    @EntityGraph(attributePaths = "treasureMission.location")
    Optional<TreasureMissionProgress> findByUserIdAndTreasureMissionMissionId(Long userId, Long missionId);
}
