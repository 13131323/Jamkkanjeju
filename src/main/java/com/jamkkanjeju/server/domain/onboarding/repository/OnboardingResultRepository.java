package com.jamkkanjeju.server.domain.onboarding.repository;

import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 사용자에게 배정할 온보딩 결과를 조회한다. */
public interface OnboardingResultRepository extends JpaRepository<OnboardingResult, Long> {

    /**
     * 결과: 유형명({@code userType})이 일치하는 온보딩 결과 중 id가 가장 작은 한 건. user_type에 UNIQUE 제약이 없어
     * 첫 번째 행을 쓴다. 연관 엔티티는 없고, 없으면 {@code Optional.empty()}이다.
     * 사용: 온보딩 완료({@code PATCH /api/v2/users/me})의 "나중에 할게요" 요청에서 기본 결과("여행자")를 찾는 데 쓴다.
     * 서비스는 결과를 사용자에게 배정해 응답 {@code user.onboardingResult}로 내보내고, 없으면 서버 오류로 처리한다.
     */
    Optional<OnboardingResult> findFirstByUserTypeOrderByIdAsc(String userType);

    /**
     * 결과: 유형명이 {@code userType}이 아닌 온보딩 결과 전체 목록. 연관 엔티티는 없고, 없으면 빈 목록이다.
     * 사용: 온보딩 완료({@code PATCH /api/v2/users/me})에서 선택값을 보낸 요청에 결과를 배정하는 데 쓴다.
     * 서비스는 기본 결과("여행자")를 제외한 이 후보 중 하나를 무작위로 골라 응답 {@code user.onboardingResult}로 내보내고,
     * 후보가 없으면 서버 오류로 처리한다.
     */
    List<OnboardingResult> findAllByUserTypeNot(String userType);
}
