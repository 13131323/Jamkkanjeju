package com.jamkkanjeju.server.domain.map.repository;

import com.jamkkanjeju.server.domain.map.entity.VisitedLocation;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 사용자별 장소 방문 기록을 조회한다. */
public interface VisitedLocationRepository extends JpaRepository<VisitedLocation, Long> {

    /**
     * 결과: 사용자와 일치하고 장소가 존재하는 방문 기록 전체 목록이다.
     * 마지막 방문 시각·장소 ID 내림차순이며 {@code location}을 함께 로딩하고 없으면 빈 목록이다.
     * 사용자·장소 조합이 유일하므로 같은 장소는 한 번만 포함한다.
     * 사용: 방명록 조회({@code GET /api/v2/guestbooks})에서 현재 사용자의 {@code visitedLocations}를 구성한다.
     * 서비스는 방명록 페이지와 관계없이 각 장소의 ID·이름을 반환한다.
     */
    @EntityGraph(attributePaths = "location")
    @Query("""
            select v from VisitedLocation v
            join v.location location
            where v.user.id = :userId
            order by v.lastVisitedAt desc, location.id desc
            """)
    List<VisitedLocation> findAllByUserId(@Param("userId") Long userId);

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
