package com.jamkkanjeju.server.domain.onboarding.repository;

import com.jamkkanjeju.server.domain.onboarding.entity.UserTravelStyle;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 결과: PK가 user_id이므로 {@code findById(userId)}는 사용자가 선택한 여행 방식 한 건(연관 엔티티는 함께 로딩되지 않음)이고,
 * 없으면 {@code Optional.empty()}이다. {@code save}는 새 선택 내역을 저장하고, {@code deleteById(userId)}는 사용자의 선택 내역을 삭제한다.
 * 사용: 온보딩 완료({@code PATCH /api/v2/users/me}) 처리에서 쓴다. 선택값을 보낸 요청에서는 {@code findById}로 찾은
 * 기존 내역의 여행 방식을 변경하고 없으면 {@code save}하며, "나중에 할게요" 요청에서는 {@code deleteById}로 삭제한다.
 */
public interface UserTravelStyleRepository extends JpaRepository<UserTravelStyle, Long> {
}
