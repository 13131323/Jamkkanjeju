package com.jamkkanjeju.server.domain.cooperativemission.repository;

import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 결과: 상속받은 {@code delete(participant)}는 참가자 한 건을 삭제하며 반환값과 추가 연관 조회가 없다.
 * 기존 DB의 ON DELETE CASCADE로 해당 참가자의 역할 진행도도 함께 삭제한다.
 * 사용: 협동 미션 중단({@code PATCH /api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress/stop})에서
 * 본인 참여와 역할 배정을 해제한다. 다른 참가자·카드 원본은 유지하며 응답 본문은 없다.
 * 상속받은 {@code deleteAll(participants)}는 전달한 참가자 목록을 삭제하며 반환값은 없다.
 * 같은 API의 팀 해산에서는 잠금 조회한 참가자 전체를 먼저 삭제 대상으로 전환한 뒤 팀을 삭제한다.
 * 역할 진행도는 기존 DB 삭제 연쇄로 정리하며 다른 팀의 참가자는 삭제하지 않는다.
 */
public interface CooperativeMissionParticipantRepository extends JpaRepository<CooperativeMissionParticipant, Long> {

    /**
     * 결과: 사용자의 참가 기록 전체이며 상태·역할·팀 상태를 제한하지 않고 없으면 빈 목록이다.
     * 팀 진행도와 세부 미션의 공통 미션·유형·장소·보상 캐릭터·쿠폰·쿠폰 사용처를 함께 로딩한다.
     * 사용: 엽서 요소 조회({@code GET /api/v2/users/me/travel-ending-elements})에서 공통 완료 판정으로
     * 수락된 완료 팀을 고르고 활성 여부·장소·완료 시각을 확인한다. 동일 미션은 서비스가 최근 완료 한 건으로 합친다.
     */
    @EntityGraph(attributePaths = {"cooperativeMissionProgress.cooperativeMission.mission.missionType",
            "cooperativeMissionProgress.cooperativeMission.location",
            "cooperativeMissionProgress.cooperativeMission.arCharacter",
            "cooperativeMissionProgress.cooperativeMission.coupon.location"})
    List<CooperativeMissionParticipant> findAllWithRewardsByUserId(Long userId);

    /**
     * 결과: 사용자({@code userId})와 공통 미션 ID 목록이 일치하는 협동 참가 기록 전체 목록이다.
     * 참가 상태·역할·팀 진행 상태를 제한하지 않고, 기록이 없으면 빈 목록이다.
     * {@code cooperativeMissionProgress.cooperativeMission}을 함께 로딩하며 그 외 연관은 함께 로딩하지 않는다.
     * 사용: 지도 홈 조회({@code GET /api/v2/map/contents}) 상세 응답에서 대상 미션의 참가 이력을 한 번에 읽는다.
     * 서비스의 공통 완료 판정기로 수락 상태와 팀 완료 여부를 확인하여 {@code locations[].mission.isCompleted}를 구성한다.
     * 여러 팀의 동일 미션 이력은 서비스가 공통 미션 ID로 모아 완료 여부를 판단한다.
     */
    @EntityGraph(attributePaths = "cooperativeMissionProgress.cooperativeMission")
    @Query("""
            select p from CooperativeMissionParticipant p
            where p.user.id = :userId
              and p.cooperativeMissionProgress.cooperativeMission.missionId in :missionIds
            """)
    List<CooperativeMissionParticipant> findAllByUserIdAndMissionIds(
            @Param("userId") Long userId, @Param("missionIds") Collection<Long> missionIds);

    /**
     * 결과: 팀 진행도({@code progressId})의 참가자 전체를 ID 오름차순으로 비관적 쓰기 잠금 조회한다.
     * 참가 상태·역할과 무관하며 연관 엔티티는 함께 로딩하지 않고, 참가자가 없으면 빈 목록이다.
     * 최신 커밋된 참가 기록을 읽으며 잠금은 트랜잭션 종료까지 유지된다.
     * 사용: 협동 미션 중단({@code PATCH /api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress/stop})에서
     * 팀 잠금 뒤 본인 참가 권한을 확인한다. 서비스가 본인을 제외한 남은 인원과 수락된 승계 후보를 판단하고
     * 합류 시각·ID순으로 방장을 승계하거나 참가자·팀을 삭제한다. 응답 본문은 없다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select p from CooperativeMissionParticipant p
            where p.cooperativeMissionProgress.id = :progressId
            order by p.id
            """)
    List<CooperativeMissionParticipant> findAllByProgressIdForUpdate(@Param("progressId") Long progressId);

    /**
     * 결과: 팀 진행도({@code progressId})에 연결된 참가자 전체 목록이다. 역할·참가 상태와 무관하게 조회한다.
     * 닉네임을 읽을 {@code user}를 함께 로딩하며 그 외 연관 엔티티는 함께 로딩하지 않는다.
     * 참가자가 없으면 빈 목록이며 조회 순서는 보장하지 않는다.
     * 사용: 상태 조회({@code GET /api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress})의
     * {@code participants}를 구성한다. 서비스가 방장 우선·나머지 생성 시각 오름차순으로 정렬하고
     * 참가자 ID·닉네임·역할·상태를 응답으로 변환한다.
     * 진행도 저장({@code PATCH /api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress})에서는
     * 서비스가 PENDING 참가자 존재 여부와 ACCEPTED 참가자별 역할 배정을 확인한다.
     * 완료 시에는 로딩된 사용자별로 최초 완료 여부를 판단하여 보상을 지급하며 응답 본문은 구성하지 않는다.
     */
    @EntityGraph(attributePaths = "user")
    List<CooperativeMissionParticipant> findAllByCooperativeMissionProgressId(Long progressId);

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
     * 상태 조회({@code GET /api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress})에서는
     * 서비스가 ACCEPTED 참가 기록 중 COMPLETED 팀을 완료 시각·진행도 ID순으로 비교해 사용자별 최초 완료 팀을 찾는다.
     * 조회 중인 팀이 최초 완료 팀일 때만 지급된 {@code reward}를 표시하고, 재도전 팀은 모든 보상 항목을 null로 구성한다.
     * 진행도 저장({@code PATCH /api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress})에서는
     * 서비스가 현재 팀을 제외한 ACCEPTED 참가·COMPLETED 팀 이력을 확인해 재도전 사용자의 추가 지급을 막는다.
     * 진행 중인 참가 기록만 있다는 이유로 재도전으로 판단하지 않으며 응답 본문은 구성하지 않는다.
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
     * 상태 조회({@code GET /api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress})에서는
     * 현재 사용자가 해당 팀의 참가자인지 확인하고 {@code currentParticipant}의 ID·역할·상태를 구성한다.
     * 진행도 저장({@code PATCH /api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress})에서는
     * 현재 사용자가 대상 팀의 HOST이자 ACCEPTED 참가자인지 서비스가 확인하며 응답 본문은 구성하지 않는다.
     * 역할 배정 저장({@code PUT /api/v2/cooperative-missions/{cooperativeMissionProgressId}/role-assignments/{roleCardId}})에서도
     * 현재 사용자의 수락된 방장 권한을 검증하며 응답 본문은 없다.
     */
    Optional<CooperativeMissionParticipant> findByCooperativeMissionProgressIdAndUserId(Long progressId, Long userId);

    /**
     * 결과: 참가자 ID({@code participantId})와 팀 진행도 ID({@code progressId})가 모두 일치하는 참가자 한 건이다.
     * 연관 엔티티는 함께 로딩하지 않고, 참가자가 없거나 다른 진행도에 속하면 빈 {@code Optional}이다.
     * 사용: 참여 요청 수락/거절({@code PATCH /api/v2/cooperative-missions/{cooperativeMissionProgressId}/participants/{participantId}})에서
     * 대상이 같은 팀의 참가자인지 확인한다. 서비스는 역할과 상태를 검증한 뒤 수락이면 상태를 변경하고,
     * 거절이면 해당 참가자를 삭제한다.
     * 역할 배정 저장({@code PUT /api/v2/cooperative-missions/{cooperativeMissionProgressId}/role-assignments/{roleCardId}})에서는
     * 서비스가 ACCEPTED 상태를 확인해 같은 팀의 방장 또는 팀원에게 역할을 연결한다. 응답 본문은 없다.
     */
    Optional<CooperativeMissionParticipant> findByIdAndCooperativeMissionProgressId(Long participantId,
                                                                                    Long progressId);

    /**
     * 결과: 팀 진행도({@code progressId})에 연결된 참가자 전체 수이다. 참가자가 없으면 {@code 0}이며,
     * 참가 상태와 역할을 구분하지 않고 집계하고 연관 엔티티는 로딩하지 않는다.
     * 사용: URL로 참여 요청({@code POST /api/v2/cooperative-missions/join-requests})에서 새 참가자를 만들기 전에
     * 방장과 PENDING·ACCEPTED 참가자를 포함한 현재 인원을 확인하고, 6명 이상이면 참여 요청을 막는다.
     */
    long countByCooperativeMissionProgressId(Long progressId);
}
