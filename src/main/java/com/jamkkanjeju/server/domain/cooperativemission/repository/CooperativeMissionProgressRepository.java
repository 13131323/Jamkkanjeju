package com.jamkkanjeju.server.domain.cooperativemission.repository;

import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionProgress;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 협동 미션 팀 진행도를 저장하는 레포지토리이다.
 * 결과: 상속받은 {@code save(progress)}는 저장된 팀 진행도를 반환하며 새 진행도에는 생성된 ID가 부여된다.
 * 연관 엔티티를 함께 조회하지 않으며, 조회 결과가 없는 경우를 다루는 메서드는 아니다.
 * 사용: 협동 미션 시작/이어하기({@code POST /api/v2/cooperative-missions/{missionId}/progress})의
 * 신규 시작에서 팀 진행도를 저장하고 본인 참가자를 연결한다. 저장된 ID와 팀 토큰으로 응답의
 * {@code cooperativeMissionProgressId}, {@code teamToken}을 구성한다.
 */
public interface CooperativeMissionProgressRepository extends JpaRepository<CooperativeMissionProgress, Long> {

    /**
     * 결과: 팀 토큰({@code teamToken})이 일치하는 협동 미션 진행도 한 건을 비관적 쓰기 잠금으로 조회한다.
     * 진행 상태와 무관하며 연관 엔티티는 함께 로딩하지 않고, 없으면 빈 {@code Optional}이다.
     * 잠금은 트랜잭션 종료까지 유지된다.
     * 사용: URL로 참여 요청({@code POST /api/v2/cooperative-missions/join-requests})에서 대상 팀을 식별하고,
     * 서비스가 진행 중 여부와 연결 미션의 활성 상태를 확인한다. 참가자 재확인·정원 계산·신규 참가자 저장을
     * 같은 잠금 범위에서 처리하여 참가자 중복 생성과 최대 인원 초과를 막는다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from CooperativeMissionProgress p where p.teamToken = :teamToken")
    Optional<CooperativeMissionProgress> findByTeamTokenForUpdate(@Param("teamToken") String teamToken);
}
