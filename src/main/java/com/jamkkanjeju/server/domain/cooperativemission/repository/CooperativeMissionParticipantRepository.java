package com.jamkkanjeju.server.domain.cooperativemission.repository;

import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CooperativeMissionParticipantRepository extends JpaRepository<CooperativeMissionParticipant, Long> {

    /**
     * 결과: 사용자({@code userId})의 협동 미션 참가 기록 전체 목록(참가 상태·팀 진행 상태 무관).
     * 팀 진행도당 최대 한 건이라 같은 팀 진행도가 중복되지 않는다.
     * 각 원소는 {@code cooperativeMissionProgress}(현재 단계·진행 상태)와 그 미션의 {@code mission.missionType}
     * (유형·이름·단계), {@code location}(장소명·좌표, 없으면 null)이 함께 로딩되어 있고, 참가 기록이 없으면 빈 목록이다.
     * 사용: 홈 조회({@code GET /api/v2/users/me/home}) 응답에서 두 곳에 쓴다.
     * {@code progressMission}의 COOPERATIVE 항목은 팀 진행 상태가 IN_PROGRESS인 기록으로 구성하고,
     * {@code missionRecommend}의 COOPERATIVE 후보에서는 완료한 기록(ACCEPTED + 팀 COMPLETED)의 미션을 제외한다.
     */
    @EntityGraph(attributePaths = {
            "cooperativeMissionProgress.cooperativeMission.mission.missionType",
            "cooperativeMissionProgress.cooperativeMission.location"
    })
    List<CooperativeMissionParticipant> findAllByUserId(Long userId);

    /**
     * 결과: 사용자({@code userId})가 공통 미션({@code missionId})의 팀에 등록된 참가 기록 전체 목록이다.
     * 참가 상태·역할·팀 진행 상태와 무관하게 조회하며, {@code cooperativeMissionProgress}를 함께 로딩한다.
     * 그 외 연관 엔티티는 함께 로딩하지 않고, 참가 기록이 없으면 빈 목록이다.
     * 사용: 협동 미션 시작/이어하기({@code POST /api/v2/cooperative-missions/{missionId}/progress})에서는
     * 서비스가 팀 IN_PROGRESS 및 참가 PENDING·ACCEPTED 조건을 확인해 이어갈 팀을 고르고, 없으면 새 팀을 만든다.
     * URL로 참여 요청({@code POST /api/v2/cooperative-missions/join-requests})에서는 대상 팀과 같은 미션의
     * 다른 진행 중인 팀에 현재 사용자가 참가 중인지 확인해 중복 참가를 막는다.
     */
    @EntityGraph(attributePaths = "cooperativeMissionProgress")
    @Query("""
            select p from CooperativeMissionParticipant p
            where p.user.id = :userId
              and p.cooperativeMissionProgress.cooperativeMission.missionId = :missionId
            """)
    List<CooperativeMissionParticipant> findAllByUserIdAndMissionId(@Param("userId") Long userId,
                                                                   @Param("missionId") Long missionId);

    /**
     * 결과: 팀 진행도({@code progressId})와 사용자({@code userId})가 모두 일치하는 참가자 한 건이다.
     * 팀·사용자 조합은 유일하며 연관 엔티티는 함께 로딩하지 않고, 참가자가 없으면 빈 {@code Optional}이다.
     * 사용: URL로 참여 요청({@code POST /api/v2/cooperative-missions/join-requests})에서 현재 사용자가 대상 팀에
     * 이미 PENDING 또는 ACCEPTED 참가자로 등록되어 있는지 확인한다. 기존 참가자이면 중복 생성하지 않고
     * 해당 ID와 상태로 {@code participantId}, {@code participantStatus}를 구성한다.
     */
    Optional<CooperativeMissionParticipant> findByCooperativeMissionProgressIdAndUserId(Long progressId, Long userId);

    /**
     * 결과: 팀 진행도({@code progressId})에 연결된 참가자 전체 수이다. 참가자가 없으면 {@code 0}이며,
     * 참가 상태와 역할을 구분하지 않고 집계하고 연관 엔티티는 로딩하지 않는다.
     * 사용: URL로 참여 요청({@code POST /api/v2/cooperative-missions/join-requests})에서 새 참가자를 만들기 전에
     * 방장과 PENDING·ACCEPTED 참가자를 포함한 현재 인원을 확인하고, 6명 이상이면 참여 요청을 막는다.
     */
    long countByCooperativeMissionProgressId(Long progressId);
}
