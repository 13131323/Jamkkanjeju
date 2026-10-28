package com.jamkkanjeju.server.domain.treasurehunt.repository;

import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TreasureMissionProgressRepository extends JpaRepository<TreasureMissionProgress, Long> {

    /**
     * 결과: 사용자({@code userId})와 공통 미션 ID 목록이 일치하는 보물찾기 진행도 전체 목록이다.
     * 진행 상태를 제한하지 않고 {@code treasureMission}을 함께 로딩하며 결과가 없으면 빈 목록이다.
     * 다른 연관 엔티티는 함께 로딩하지 않는다.
     * 사용: 지도 홈 조회({@code GET /api/v2/map/contents}) 상세 응답에서 화면에 표시할 미션의 이력만 읽고
     * 공통 완료 판정기로 {@code locations[].mission.isCompleted}를 판단한다. 쿼리에서 완료 여부를 결정하지 않는다.
     */
    @EntityGraph(attributePaths = "treasureMission")
    List<TreasureMissionProgress> findAllByUserIdAndTreasureMissionMissionIdIn(Long userId,
                                                                            Collection<Long> missionIds);

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

    /**
     * 결과: 진행도 ID({@code id})가 사용자({@code userId}) 소유이고 진행 상태가 {@code missionStatus}인 진행도 한 건이다.
     * 보물찾기 미션과 보상 정보({@code treasureMission.arCharacter}, {@code treasureMission.coupon.location})를
     * 함께 로딩하며, 없거나 다른 사용자 소유이거나 상태가 다르면 빈 {@code Optional}이다.
     * 사용: 보물찾기 진행도 저장({@code PATCH /api/v2/treasure-missions/{treasureMissionProgressId}/progress})에서
     * IN_PROGRESS로 조회하고 서비스가 미션 활성 상태를 확인한다. 보물 발견에 따라 찾은 개수·완료 상태를 갱신하고,
     * 미션의 보상 정보와 기존 지급 여부로 이번에 지급할 보상을 골라 응답의 {@code reward}를 구성한다.
     * 보물찾기 중단({@code PATCH /api/v2/treasure-missions/{treasureMissionProgressId}/progress/stop})에서도
     * IN_PROGRESS로 조회하고 비활성 여부를 검증한 뒤, 찾은 개수는 유지하면서 상태·완료 시각만 갱신한다.
     * 중단에서는 함께 로딩된 보상 정보를 사용해 보상을 지급하지 않는다.
     */
    @EntityGraph(attributePaths = {"treasureMission.arCharacter", "treasureMission.coupon.location"})
    Optional<TreasureMissionProgress> findByIdAndUserIdAndMissionStatus(Long id, Long userId,
                                                                       MissionProgressStatus missionStatus);
}
