package com.jamkkanjeju.server.domain.onboarding.repository;

import com.jamkkanjeju.server.domain.onboarding.entity.UserTransportation;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 결과: PK가 user_id이므로 {@code findById(userId)}는 사용자가 선택한 이동 수단 한 건(연관 엔티티는 함께 로딩되지 않음)이고,
 * 없으면 {@code Optional.empty()}이다. {@code save}는 새 선택 내역을 저장하고, {@code deleteById(userId)}는 사용자의 선택 내역을 삭제한다.
 * 사용: 온보딩 완료({@code PATCH /api/v2/users/me}) 처리에서 쓴다. 선택값을 보낸 요청에서는 {@code findById}로 찾은
 * 기존 내역의 이동 수단을 변경하고 없으면 {@code save}하며, "나중에 할게요" 요청에서는 {@code deleteById}로 삭제한다.
 */
public interface UserTransportationRepository extends JpaRepository<UserTransportation, Long> {

    /**
     * 결과: 사용자의 선택 내역과 {@code transportation} 기준 항목을 함께 조회한다.
     * 선택 내역이 없으면 빈 Optional이다. 사용자 연관은 함께 로딩하지 않는다.
     * 사용: 사용자 정보 조회({@code GET /api/v2/users/me})에서 저장된 선택 코드로 응답을 구성한다.
     * 사용자 정보 변경({@code PATCH /api/v2/users/me/profile})에서는 생략한 선택을 유지하고 실제 변경 여부를 비교한다.
     */
    @EntityGraph(attributePaths = "transportation")
    Optional<UserTransportation> findWithTransportationByUserId(Long userId);
}
