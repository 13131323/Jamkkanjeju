package com.jamkkanjeju.server.domain.guestbook.repository;

import com.jamkkanjeju.server.domain.guestbook.entity.GuestbookStatus;
import com.jamkkanjeju.server.domain.guestbook.entity.RoadGuestbook;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 길바닥 방명록을 자체 좌표 범위로 조회한다. */
public interface RoadGuestbookRepository extends JpaRepository<RoadGuestbook, Long> {

    /**
     * 결과: 공통 방명록 ID와 공통 방명록 상태가 일치하는 길바닥 방명록 한 건이다.
     * {@code guestbook.user}를 함께 로딩하며 작성자가 없어도 방명록은 유지하고 사용자만 null이다.
     * 해당 ID가 없거나 상태가 다르면 빈 {@code Optional}이다.
     * 사용: 지도 모달 조회({@code GET /api/v2/map/modals})에서 서비스가 ACTIVE를 전달하여
     * 위치 별칭·거리·시간의 좌표와 작성자 닉네임·방문일·저장된 콘텐츠를 구성한다.
     * 빈 결과는 서비스에서 조회 대상 없음 오류로 처리한다.
     */
    @EntityGraph(attributePaths = "guestbook.user")
    Optional<RoadGuestbook> findByGuestbookIdAndGuestbookStatus(Long guestbookId, GuestbookStatus status);

    /**
     * 결과: 공통 방명록 상태가 {@code status}이고 지정한 위도·경도 범위 내부와 경계인 길바닥 방명록 목록이다.
     * {@code guestbook}을 함께 로딩하며 결과가 없으면 빈 목록이다.
     * 사용: 지도 홈 조회({@code GET /api/v2/map/contents}) 상세 응답에서 서비스가 계산한 확장 범위를 전달하고
     * ACTIVE 상태로 {@code roadGuestbooks}의 ID·좌표·위치 별칭과 공통 방명록의 첨부 이미지 URL을 구성한다.
     */
    @EntityGraph(attributePaths = "guestbook")
    List<RoadGuestbook> findAllByGuestbookStatusAndLatitudeBetweenAndLongitudeBetween(
            GuestbookStatus status, double minLatitude, double maxLatitude, double minLongitude, double maxLongitude);

    /**
     * 결과: 공통 방명록 상태가 {@code status}이고 지정한 범위 내부와 경계인 길바닥 방명록 ID·위도·경도 목록이다.
     * 없으면 빈 목록이다.
     * 공통 방명록 본문·이미지·위치 별칭이나 연관 엔티티를 로딩하지 않는다.
     * 사용: 지도 홈 조회({@code GET /api/v2/map/contents}) 간소 응답의 {@code roadGuestbooks}를 구성한다.
     * 상세 응답과 같은 확장 범위와 ACTIVE를 전달하며 서버에서 항목을 군집으로 합치지 않는다.
     */
    @Query("""
            select r.guestbookId as id, r.latitude as latitude, r.longitude as longitude
            from RoadGuestbook r
            where r.latitude between :minLatitude and :maxLatitude
              and r.longitude between :minLongitude and :maxLongitude
              and r.guestbook.status = :status
            """)
    List<Position> findPositionsByBounds(@Param("minLatitude") double minLatitude,
                                       @Param("maxLatitude") double maxLatitude,
                                       @Param("minLongitude") double minLongitude,
                                       @Param("maxLongitude") double maxLongitude,
                                       @Param("status") GuestbookStatus status);

    /** 공통 방명록 ID와 길바닥 방명록 좌표만 담는 조회 결과이다. */
    interface Position {
        Long getId();
        double getLatitude();
        double getLongitude();
    }
}
