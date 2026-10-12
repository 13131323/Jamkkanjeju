package com.jamkkanjeju.server.domain.onboarding.repository;

import com.jamkkanjeju.server.domain.onboarding.entity.UserTravelStyle;
import org.springframework.data.jpa.repository.JpaRepository;

/** PK가 user_id이므로 사용자별 조회·삭제는 findById / deleteById를 쓴다. */
public interface UserTravelStyleRepository extends JpaRepository<UserTravelStyle, Long> {
}
