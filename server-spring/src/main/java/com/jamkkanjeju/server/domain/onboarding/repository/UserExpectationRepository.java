package com.jamkkanjeju.server.domain.onboarding.repository;

import com.jamkkanjeju.server.domain.onboarding.entity.UserExpectation;
import com.jamkkanjeju.server.domain.onboarding.entity.UserExpectationId;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/** 사용자가 선택한 여행 기대 항목을 조회·저장·삭제한다. */
public interface UserExpectationRepository extends JpaRepository<UserExpectation, UserExpectationId> {

    /**
     * 결과: 사용자({@code userId})가 선택한 여행 기대 항목 목록. 항목당 최대 한 건이며, 연관 엔티티는 함께 로딩되지 않고
     * 복합 키({@code id.expectationId})로 선택한 항목을 구분한다. 선택 내역이 없으면 빈 목록이다.
     * 사용: 온보딩 완료({@code PATCH /api/v2/users/me}) 처리에서 쓴다. 선택값을 보낸 요청에서는 요청 항목과 비교해
     * 빠진 항목만 {@code deleteAll}, 새 항목만 {@code saveAll}하고, "나중에 할게요" 요청에서는 결과 전체를 {@code deleteAll}한다.
     */
    List<UserExpectation> findAllByUserId(Long userId);

    /**
     * 결과: 사용자의 선택 내역과 {@code expectation} 기준 항목을 함께 조회한다.
     * 선택 내역이 없으면 빈 목록이다. 사용자 연관은 함께 로딩하지 않는다.
     * 사용: 사용자 정보 조회({@code GET /api/v2/users/me})에서 저장된 선택 코드로 응답을 구성한다.
     * 사용자 정보 변경({@code PATCH /api/v2/users/me/profile})에서는 생략한 선택을 유지하고 실제 변경 여부를 비교한다.
     */
    @EntityGraph(attributePaths = "expectation")
    List<UserExpectation> findAllWithExpectationByUserId(Long userId);
}
