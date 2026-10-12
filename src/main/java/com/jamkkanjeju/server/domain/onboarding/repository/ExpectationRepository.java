package com.jamkkanjeju.server.domain.onboarding.repository;

import com.jamkkanjeju.server.domain.onboarding.entity.Expectation;
import com.jamkkanjeju.server.domain.onboarding.entity.ExpectationType;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExpectationRepository extends JpaRepository<Expectation, Long> {

    List<Expectation> findAllByExpectationTypeIn(Collection<ExpectationType> expectationTypes);
}
