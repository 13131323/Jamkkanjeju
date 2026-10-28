package com.jamkkanjeju.server.domain.guestbook.repository;

import com.jamkkanjeju.server.domain.guestbook.entity.GuestbookStatus;
import com.jamkkanjeju.server.domain.guestbook.entity.LocationGuestbook;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 장소 방명록의 장소별 개수와 사용자별 미션 작성 참조를 묶어서 조회한다.
 * 결과: 상속받은 {@code save()}는 공통 방명록과 PK를 공유하는 장소 방명록을 저장한다.
 * 본인의 방문 기록과 선택 미션을 참조하며 연관 엔티티를 함께 조회하지 않는다.
 * 사용: 방명록 작성({@code POST /api/v2/guestbooks})의 GENERAL 요청에서 검증한 방문·미션을 연결하고,
 * 저장된 공통 내용과 함께 응답의 {@code guestbookId}, {@code locationId}, {@code missionId}를 구성한다.
 */
public interface LocationGuestbookRepository extends JpaRepository<LocationGuestbook, Long> {

    /**
     * 결과: 공통 방명록 상태가 일치하고 방문 기록·장소가 존재하는 일반 방명록의 요청 Slice이다.
     * 저장 시각·공통 방명록 ID 내림차순이며 전체 개수는 집계하지 않는다.
     * {@code visitedLocation.location}, {@code guestbook.user.onboardingResult}, {@code mission.missionType}을
     * 함께 로딩한다. 작성자·온보딩·미션이 없어도 유지하고, 결과가 없으면 내용이 빈 Slice이다.
     * 사용: 방명록 조회({@code GET /api/v2/guestbooks})에서 서비스가 ACTIVE와 일반 페이지 조건을 전달하여
     * {@code generalGuestbooks}와 {@code generalGuestbooksPage}를 구성하고 반환 행의 ID만 좋아요 조회에 쓴다.
     */
    @EntityGraph(attributePaths = {"visitedLocation.location", "guestbook.user.onboardingResult", "mission.missionType"})
    @Query("""
            select l from LocationGuestbook l
            join l.visitedLocation v
            join v.location location
            where l.guestbook.status = :status
            order by l.guestbook.savedAt desc, l.guestbook.id desc
            """)
    Slice<LocationGuestbook> findSliceByStatus(@Param("status") GuestbookStatus status, Pageable pageable);

    /**
     * 결과: 장소와 공통 방명록 상태가 일치하는 장소 방명록의 요청 페이지와 다음 페이지 존재 여부이다.
     * 방문일 내림차순·공통 방명록 ID 내림차순이며 전체 개수 집계는 하지 않는다.
     * {@code guestbook.user.onboardingResult}와 {@code mission.missionType}을 함께 로딩한다.
     * 작성자·온보딩·미션이 없어도 방명록은 유지하고, 결과가 없으면 내용이 빈 {@code Slice}이다.
     * 사용: 지도 장소 상세 조회({@code GET /api/v2/map/locations/{locationId}})에서 서비스가 ACTIVE와
     * 요청 페이지·크기(기본 0·20)를 전달하여 {@code guestbooks}와 {@code guestbooksPage}를 구성한다.
     */
    @EntityGraph(attributePaths = {"guestbook.user.onboardingResult", "mission.missionType"})
    @Query("""
            select l from LocationGuestbook l
            where l.visitedLocation.location.id = :locationId
              and l.guestbook.status = :status
            order by l.guestbook.visitedAt desc, l.guestbook.id desc
            """)
    Slice<LocationGuestbook> findSliceByLocationIdAndStatus(@Param("locationId") Long locationId,
                                                          @Param("status") GuestbookStatus status,
                                                          Pageable pageable);

    /**
     * 결과: 지정한 장소에 연결되고 공통 방명록 상태가 {@code status}인 장소 방명록 목록이다.
     * 방문일 내림차순·공통 방명록 ID 내림차순으로 정렬하고 {@code pageable}의 범위만 조회한다.
     * {@code guestbook.user.onboardingResult}와 {@code mission.missionType}을 함께 로딩한다.
     * 작성자·온보딩 결과·미션이 없어도 방명록은 유지하며 해당 연관만 null이고, 결과가 없으면 빈 목록이다.
     * 사용: 지도 모달 조회({@code GET /api/v2/map/modals})의 장소 응답에서 서비스가 ACTIVE와
     * 첫 페이지 크기 3을 전달하여 {@code guestbooks}를 구성한다. 전체 개수는 별도 집계 결과를 사용한다.
     */
    @EntityGraph(attributePaths = {"guestbook.user.onboardingResult", "mission.missionType"})
    @Query("""
            select l from LocationGuestbook l
            where l.visitedLocation.location.id = :locationId
              and l.guestbook.status = :status
            order by l.guestbook.visitedAt desc, l.guestbook.id desc
            """)
    List<LocationGuestbook> findAllByLocationIdAndStatus(@Param("locationId") Long locationId,
                                                       @Param("status") GuestbookStatus status,
                                                       Pageable pageable);

    /**
     * 결과: 전달한 장소 ID별로 공통 방명록 상태가 {@code status}인 장소 방명록 개수 목록이다.
     * 모든 작성자·미션 연결 여부를 포함한다.
     * 장소 참조가 없는 기록은 제외하며 방명록이 없는 장소의 행은 없고, 결과가 없으면 빈 목록이다.
     * 집계 프로젝션만 반환하며 연관 엔티티는 로딩하지 않는다.
     * 사용: 지도 홈 조회({@code GET /api/v2/map/contents}) 상세 응답의 {@code locations[].guestbooksCount}에 쓴다.
     * 서비스가 ACTIVE를 전달하고 장소 ID별로 조합하며 조회 행이 없는 장소는 0으로 구성한다.
     * 지도 모달 조회({@code GET /api/v2/map/modals})에서도 대상 장소 ID 한 건과 ACTIVE를 전달하여
     * 최신 목록 길이와 무관한 {@code guestbooksCount}를 구성한다.
     */
    @Query("""
            select v.location.id as locationId, count(l) as guestbookCount
            from LocationGuestbook l
            join l.visitedLocation v
            where v.location.id in :locationIds
              and l.guestbook.status = :status
            group by v.location.id
            """)
    List<LocationCount> countByLocationIdsAndStatus(@Param("locationIds") Collection<Long> locationIds,
                                                   @Param("status") GuestbookStatus status);

    /**
     * 결과: 사용자({@code userId})가 지정한 장소들에서 작성하고 공통 방명록 상태가 {@code status}인
     * 방명록의 장소 ID·공통 미션 ID 조합 목록이다.
     * 장소·미션 연결이 없는 기록은 제외하고 같은 조합은 한 번만 반환하며, 결과가 없으면 빈 목록이다.
     * 작성 참조 프로젝션만 반환하며 연관 엔티티나 방명록 본문은 로딩하지 않는다.
     * 사용: 지도 홈 조회({@code GET /api/v2/map/contents}) 상세 응답에서 서비스가 완료된 미션에 한해
     * 장소·미션 조합의 존재 여부로 {@code locations[].mission.hasWrittenGuestbook}를 구성한다.
     * 서비스가 ACTIVE를 전달한다. 완료 여부는 이 쿼리가 판정하지 않고, 미완료 미션은 서비스에서 null로 구성한다.
     */
    @Query("""
            select distinct v.location.id as locationId, l.mission.id as missionId
            from LocationGuestbook l
            join l.visitedLocation v
            where l.guestbook.user.id = :userId
              and l.guestbook.status = :status
              and v.location.id in :locationIds
              and l.mission is not null
            """)
    List<MissionReference> findMissionReferencesByUserIdAndLocationIdsAndStatus(
            @Param("userId") Long userId, @Param("locationIds") Collection<Long> locationIds,
            @Param("status") GuestbookStatus status);

    /** 장소별 장소 방명록 집계 결과이다. */
    interface LocationCount {
        Long getLocationId();
        long getGuestbookCount();
    }

    /** 현재 사용자가 작성한 장소·공통 미션 연결 정보이다. */
    interface MissionReference {
        Long getLocationId();
        Long getMissionId();
    }
}
