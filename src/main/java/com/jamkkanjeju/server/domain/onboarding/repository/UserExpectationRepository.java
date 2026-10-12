package com.jamkkanjeju.server.domain.onboarding.repository;

import com.jamkkanjeju.server.domain.onboarding.entity.UserExpectation;
import com.jamkkanjeju.server.domain.onboarding.entity.UserExpectationId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserExpectationRepository extends JpaRepository<UserExpectation, UserExpectationId> {

    List<UserExpectation> findAllByUserId(Long userId);
}
