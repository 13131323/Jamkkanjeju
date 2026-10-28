package com.jamkkanjeju.server.domain.onboarding.repository;

import com.jamkkanjeju.server.domain.onboarding.entity.Transportation;
import com.jamkkanjeju.server.domain.onboarding.entity.TransportationType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 이동 수단 기준 데이터를 조회한다. */
public interface TransportationRepository extends JpaRepository<Transportation, Long> {

    /**
     * 결과: 종류({@code transportationType})에 해당하는 이동 수단 기준 데이터 한 건(종류에 UNIQUE 제약이 있다).
     * 연관 엔티티는 없고, 없으면 {@code Optional.empty()}이다.
     * 사용: 온보딩 완료({@code PATCH /api/v2/users/me}) 처리에서 사용자의 이동 수단을 저장하는 데 쓴다.
     * 서비스는 결과로 기존 선택 내역을 변경하거나 새로 저장하고, 없으면 기준 데이터 누락으로 보고 서버 오류로 처리한다.
     */
    Optional<Transportation> findByTransportationType(TransportationType transportationType);
}
