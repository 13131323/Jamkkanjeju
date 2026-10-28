package com.jamkkanjeju.server.domain.guestbook.repository;

import com.jamkkanjeju.server.domain.guestbook.entity.GuestbookLike;
import com.jamkkanjeju.server.domain.guestbook.entity.GuestbookLikeId;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 일반·길바닥 방명록의 좋아요 여부와 전체 개수를 조회하고 등록·취소한다.
 * 결과: 상속받은 {@code findById()}는 방명록·사용자 복합 키의 좋아요 한 건 또는 빈 Optional을 반환한다.
 * 연관 엔티티는 함께 로딩하지 않는다. {@code save()}는 좋아요를 저장해 반환하고,
 * {@code delete()}는 전달한 좋아요를 실제 삭제하며 {@code flush()}는 변경을 DB에 반영한다.
 * 사용: 방명록 좋아요 토글({@code POST /api/v2/guestbooks/{guestbookId}/like})에서 서비스가
 * 방명록 잠금 이후 현재 사용자의 행 유무에 따라 생성·삭제하고 응답의 {@code isLiked}를 구성한다.
 * 변경 후 전체 개수는 별도 집계하며 실패 시 트랜잭션 전체를 롤백한다.
 */
public interface GuestbookLikeRepository extends JpaRepository<GuestbookLike, GuestbookLikeId> {

    /**
     * 결과: 공통 방명록 ID에 연결된 전체 좋아요 행 수이다. 현재 사용자·작성자 구분 없이 세며 없으면 0이다.
     * 좋아요 본문이나 연관 엔티티는 로딩하지 않는다.
     * 사용: 방명록 좋아요 토글({@code POST /api/v2/guestbooks/{guestbookId}/like})에서 서비스가
     * 등록·삭제 내용을 flush한 뒤 조회하여 처리 후 {@code likeCount}를 구성한다.
     */
    long countByGuestbookId(Long guestbookId);

    /**
     * 결과: 전달한 방명록 중 사용자와 좋아요 조합이 존재하는 공통 방명록 ID 목록이다.
     * 연관 엔티티를 로딩하지 않으며 해당 좋아요가 없으면 빈 목록이다.
     * 사용: 방명록 조회({@code GET /api/v2/guestbooks})에서 서비스가 실제 반환할 두 페이지의 ID와
     * 현재 사용자 ID를 전달하여 각 항목의 {@code isLiked}를 구성한다. 빈 ID 목록은 서비스가 조회를 생략한다.
     */
    @Query("""
            select l.id.guestbookId from GuestbookLike l
            where l.id.userId = :userId
              and l.id.guestbookId in :guestbookIds
            """)
    List<Long> findGuestbookIdsByUserIdAndGuestbookIds(@Param("userId") Long userId,
                                                     @Param("guestbookIds") Collection<Long> guestbookIds);

    /**
     * 결과: 전달한 공통 방명록 ID별 전체 좋아요 수의 집계 목록이다. 작성자·현재 사용자 구분 없이 센다.
     * 연관 엔티티를 로딩하지 않으며 좋아요가 없는 ID의 행은 없고 전체 결과가 없으면 빈 목록이다.
     * 사용: 방명록 조회({@code GET /api/v2/guestbooks})에서 서비스가 실제 반환할 두 페이지의 ID를 전달하여
     * {@code likeCount}를 구성한다. 집계 행이 없는 ID는 0으로 구성하고 빈 ID 목록은 조회를 생략한다.
     */
    @Query("""
            select l.id.guestbookId as guestbookId, count(l) as likeCount
            from GuestbookLike l
            where l.id.guestbookId in :guestbookIds
            group by l.id.guestbookId
            """)
    List<LikeCount> countByGuestbookIds(@Param("guestbookIds") Collection<Long> guestbookIds);

    /** 공통 방명록별 전체 좋아요 수이다. */
    interface LikeCount {
        Long getGuestbookId();
        long getLikeCount();
    }
}
