package com.jamkkanjeju.server.domain.cooperativemission.repository;

import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionRoleProgress;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionRoleProgressId;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

/**
 * 참가자와 역할 카드의 복합키로 식별하는 협동 미션 역할 수행 기록을 조회·저장한다.
 * 결과: 상속받은 {@code save(roleProgress)}는 저장된 역할 기록을 반환하고,
 * {@code delete(roleProgress)}와 {@code flush()}는 반환값이 없으며 연관 엔티티를 함께 조회하지 않는다.
 * 사용: 역할 배정 저장({@code PUT /api/v2/cooperative-missions/{cooperativeMissionProgressId}/role-assignments/{roleCardId}})에서
 * 최초 배정을 저장하거나 담당자 변경 시 이전 복합키 행을 제거·반영한 뒤 새 참가자·동일 카드 행을 저장한다.
 * 동일 배정은 저장하지 않고 유지하며 응답 본문은 구성하지 않는다.
 * 역할 진행도 저장({@code POST /api/v2/cooperative-missions/{cooperativeMissionProgressId}/role-progresses/{roleCardId}/verification})에서는
 * 상속받은 {@code saveAndFlush(roleProgress)}로 인증 URL·상태·완료 시각의 변경을 DB에 반영하고 저장한 기록을 반환한다.
 * 서비스가 {@code isVerified}를 구성하며 연관 엔티티를 별도로 조회하는 메서드는 아니다.
 */
public interface CooperativeMissionRoleProgressRepository
        extends JpaRepository<CooperativeMissionRoleProgress, CooperativeMissionRoleProgressId> {

    /**
     * 결과: 팀 진행도({@code progressId})와 역할 카드({@code roleCardId})가 모두 일치하는 역할 수행 기록 한 건이다.
     * 담당 참가자·인증 상태와 무관하게 조회하며 {@code participant}와 {@code roleCard}를 함께 로딩한다.
     * 참가자의 사용자·팀 진행도 등 그 외 연관 엔티티는 함께 로딩하지 않는다.
     * 비관적 쓰기 잠금으로 최신 커밋된 배정을 읽으며 잠금은 트랜잭션 종료까지 유지된다.
     * 배정이 없으면 빈 {@code Optional}이며 한 팀에서 카드별 담당자는 최대 한 명이라는 배정 규칙을 전제로 한다.
     * 사용: 역할 배정 저장({@code PUT /api/v2/cooperative-missions/{cooperativeMissionProgressId}/role-assignments/{roleCardId}})에서
     * 서비스가 팀 진행도 잠금을 얻은 뒤 기존 배정을 확인한다. 없으면 생성하고, 같은 참가자이면 유지하며,
     * 다른 참가자이면 수행 상태·인증 이미지·완료 시각을 보존해 복합키 행을 교체한다. 응답 본문은 없다.
     * 역할 진행도 저장({@code POST /api/v2/cooperative-missions/{cooperativeMissionProgressId}/role-progresses/{roleCardId}/verification})에서는
     * 서비스가 담당 사용자·수락·중복 완료를 검증하고 카드 정보로 사진 판정을 요청한 뒤 인증 결과를 저장한다.
     * 이미 완료된 기록도 반환하여 별도의 완료 오류로 구분하며 응답은 {@code isVerified}만 구성한다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"participant", "roleCard"})
    Optional<CooperativeMissionRoleProgress> findByParticipantCooperativeMissionProgressIdAndRoleCardId(
            Long progressId, Long roleCardId);

    /**
     * 결과: 팀 진행도({@code progressId})의 참가자에게 연결된 역할 수행 기록 전체 목록이다.
     * 인증 상태와 무관하며 참가자 ID·카드 ID 오름차순으로 정렬하고, 기록이 없으면 빈 목록이다.
     * {@code participant.user}(담당자 닉네임)와 {@code roleCard}(역할 이름)를 함께 로딩한다.
     * 사용: 상태 조회({@code GET /api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress})에서
     * 서비스가 {@code roleProgresses}를 구성하고 목록 크기로 {@code totalRoleCount},
     * 완료 상태인 원소 수로 {@code completedRoleCount}를 계산한다. 다른 팀의 같은 카드 수행 기록은 포함하지 않는다.
     * 진행도 저장({@code PATCH /api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress})에서는
     * 서비스가 참가자별 배정 유무를 확인해 수행 단계 진입을 검증하고, 실제 배정 기록의 인증 완료 여부로
     * 완료 단계 진입을 검증한다. 역할을 생성·변경하거나 응답 본문을 구성하지 않는다.
     */
    @EntityGraph(attributePaths = {"participant.user", "roleCard"})
    List<CooperativeMissionRoleProgress>
            findAllByParticipantCooperativeMissionProgressIdOrderByParticipantIdAscRoleCardIdAsc(Long progressId);
}
