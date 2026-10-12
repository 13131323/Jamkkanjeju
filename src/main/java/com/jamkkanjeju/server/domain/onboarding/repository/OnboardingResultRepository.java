package com.jamkkanjeju.server.domain.onboarding.repository;

import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OnboardingResultRepository extends JpaRepository<OnboardingResult, Long> {

    /** 기본 온보딩 결과("여행자") 조회. user_type에 UNIQUE 제약이 없어 첫 번째 행을 쓴다. */
    Optional<OnboardingResult> findFirstByUserTypeOrderByIdAsc(String userType);

    /** 무작위 배정 후보 조회. 기본 온보딩 결과("여행자")를 제외한다. */
    List<OnboardingResult> findAllByUserTypeNot(String userType);
}
