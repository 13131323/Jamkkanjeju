package com.jamkkanjeju.server.domain.onboarding.repository;

import com.jamkkanjeju.server.domain.onboarding.entity.TravelStyle;
import com.jamkkanjeju.server.domain.onboarding.entity.TravelStyleType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TravelStyleRepository extends JpaRepository<TravelStyle, Long> {

    Optional<TravelStyle> findByTravelStyleType(TravelStyleType travelStyleType);
}
