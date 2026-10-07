package com.jamkkanjeju.server.domain.onboarding.repository;

import com.jamkkanjeju.server.domain.onboarding.entity.Transportation;
import com.jamkkanjeju.server.domain.onboarding.entity.TransportationType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransportationRepository extends JpaRepository<Transportation, Long> {

    Optional<Transportation> findByTransportationType(TransportationType transportationType);
}
