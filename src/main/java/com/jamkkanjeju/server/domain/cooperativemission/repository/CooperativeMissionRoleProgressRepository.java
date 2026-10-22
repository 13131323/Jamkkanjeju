package com.jamkkanjeju.server.domain.cooperativemission.repository;

import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionRoleProgress;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionRoleProgressId;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/** 참가자와 역할 카드의 복합키로 식별하는 협동 미션 역할 수행 기록을 조회하는 레포지토리이다. */
public interface CooperativeMissionRoleProgressRepository
        extends JpaRepository<CooperativeMissionRoleProgress, CooperativeMissionRoleProgressId> {

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
