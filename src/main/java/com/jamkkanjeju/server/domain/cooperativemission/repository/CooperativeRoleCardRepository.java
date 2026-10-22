package com.jamkkanjeju.server.domain.cooperativemission.repository;

import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeRoleCard;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 협동 미션에서 공통으로 사용하는 역할 카드를 조회한다.
 * 결과: 상속받은 {@code findById(roleCardId)}는 역할 카드 한 건이며, 없으면 빈 {@code Optional}이다.
 * 연관 엔티티는 함께 로딩하지 않는다.
 * 사용: 역할 배정 저장({@code PUT /api/v2/cooperative-missions/{cooperativeMissionProgressId}/role-assignments/{roleCardId}})에서
 * 공통 카드 존재 여부를 확인하고 신규 배정이나 담당자 교체의 카드로 연결한다. 미션별로 제한하지 않으며 응답 본문은 없다.
 */
public interface CooperativeRoleCardRepository extends JpaRepository<CooperativeRoleCard, Long> {

    /**
     * 결과: 공통 역할 카드 전체를 카드 ID 오름차순으로 반환한다.
     * 연관 엔티티는 함께 로딩하지 않으며 카드가 없으면 빈 목록이다.
     * 사용: 상태 조회({@code GET /api/v2/cooperative-missions/{cooperativeMissionProgressId}/progress})의
     * {@code roleCards}를 구성한다. 서비스가 첫 단계·수행 단계에서 카드 ID·이름·설명·찾을 대상 목록으로 변환한다.
     */
    List<CooperativeRoleCard> findAllByOrderByIdAsc();
}
