package com.jamkkanjeju.server.domain.map.repository;

import com.jamkkanjeju.server.domain.map.entity.VisitedLocation;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 사용자별 장소 방문 기록을 조회한다. */
public interface VisitedLocationRepository extends JpaRepository<VisitedLocation, Long> {

    /**
     * 결과: 사용자와 장소가 모두 일치하는 방문 기록 한 건이다. 사용자·장소 조합은 유일하며
     * 연관 엔티티는 함께 로딩하지 않고, 방문 기록이 없으면 빈 {@code Optional}이다.
     * 사용: 방명록 작성({@code POST /api/v2/guestbooks})의 GENERAL 요청에서 본인의 방문 이력을 확인하고
     * 새 장소 방명록의 {@code visitedLocation}으로 연결한다. 서비스가 요청 장소와 미션을 별도로 검증하며,
     * 응답의 {@code locationId}는 이 기록이 참조하는 장소 ID로 구성한다.
     */
    Optional<VisitedLocation> findByUserIdAndLocationId(Long userId, Long locationId);

    /**
     * 결과: 사용자와 장소가 모두 일치하는 방문 기록이 있으면 true, 없으면 false이다.
     * 방문 기록이나 연관 사용자·장소 엔티티는 로딩하지 않는다.
     * 사용: 지도 모달 조회({@code GET /api/v2/map/modals})의 장소 응답에서 {@code isVisited}를 구성한다.
     * 미션 완료나 방명록 작성 여부와 별개로 실제 방문 기록의 존재만 확인한다.
     */
    boolean existsByUserIdAndLocationId(Long userId, Long locationId);
}
