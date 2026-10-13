package com.jamkkanjeju.server.domain.onboarding.repository;

import com.jamkkanjeju.server.domain.onboarding.entity.Expectation;
import com.jamkkanjeju.server.domain.onboarding.entity.ExpectationType;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** 여행 기대 항목 기준 데이터를 조회한다. */
public interface ExpectationRepository extends JpaRepository<Expectation, Long> {

    /**
     * 결과: 요청한 종류({@code expectationTypes})에 해당하는 여행 기대 항목 기준 데이터 목록. 종류당 최대 한 건이며
     * 연관 엔티티는 없다. 일치하는 기준 데이터가 없으면 빈 목록이다.
     * 사용: 온보딩 완료({@code PATCH /api/v2/users/me}) 처리에서 사용자의 여행 기대 항목을 저장하는 데 쓴다.
     * 서비스는 결과 건수가 요청 종류 수와 다르면 기준 데이터 누락으로 보고 실패시키고,
     * 일치하면 기존 선택 내역과 비교해 차이만 반영한다.
     */
    List<Expectation> findAllByExpectationTypeIn(Collection<ExpectationType> expectationTypes);
}
