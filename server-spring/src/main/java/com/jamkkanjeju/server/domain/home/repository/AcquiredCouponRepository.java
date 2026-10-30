package com.jamkkanjeju.server.domain.home.repository;

import com.jamkkanjeju.server.domain.home.entity.AcquiredCoupon;
import com.jamkkanjeju.server.domain.home.entity.AcquiredCouponId;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 사용자가 획득한 쿠폰 기록을 조회·저장하는 레포지토리이다.
 * 결과: 상속받은 {@code existsById(new AcquiredCouponId(couponId, userId))}는 사용자가 그 쿠폰을 이미 보유했는지 여부이고,
 * {@code save(acquiredCoupon)}는 저장한 획득 기록을 돌려준다. (쿠폰, 사용자)가 PK라 사용자당 같은 쿠폰은 한 건이다.
 * 사용: 문화 미션 진행도 저장({@code PATCH /api/v2/culture-missions/{cultureMissionProgressId}/progress})의 완료 보상으로
 * 쿠폰을 지급할 때, 이미 보유한 쿠폰이면 행을 새로 만들지 않고 없으면 저장한다. 응답의 {@code reward.coupon}을 구성한다.
 */
public interface AcquiredCouponRepository extends JpaRepository<AcquiredCoupon, AcquiredCouponId> {

    /**
     * 결과: 쿠폰·사용자 복합키의 획득 기록 한 건을 쓰기 잠금으로 조회한다. 없으면 빈 Optional이다.
     * 연관 엔티티는 함께 로딩하지 않으며 잠금은 트랜잭션 종료까지 유지한다.
     * 사용: 쿠폰 사용 처리({@code PATCH /api/v2/coupons/{couponId}/use})에서 사용 시각을 확인·저장한다.
     * 같은 기록의 동시 사용 요청을 순서대로 확인해 중복 사용을 막으며 응답 본문은 없다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from AcquiredCoupon a where a.id = :id")
    Optional<AcquiredCoupon> findByIdForUpdate(@Param("id") AcquiredCouponId id);

    /**
     * 결과: 사용자({@code userId})가 획득한 쿠폰 중 사용처가 장소 ID 목록에 있는 획득 기록 전체 목록이다.
     * {@code coupon.location}을 함께 로딩하며 결과가 없으면 빈 목록이다. 사용자 연관은 함께 로딩하지 않는다.
     * 쿠폰·사용자 복합키당 한 건이고 서로 다른 쿠폰은 금액이 같아도 모두 반환한다.
     * 사용: 지도 홈 조회({@code GET /api/v2/map/contents}) 상세 응답의 {@code locations[].receivedCoupons}를 구성한다.
     * 서비스가 쿠폰 사용처 ID별로 모아 쿠폰 ID·금액·주소·사용 시각으로 변환하고 해당 장소의 결과가 없으면 null로 구성한다.
     */
    @EntityGraph(attributePaths = "coupon.location")
    List<AcquiredCoupon> findAllByUserIdAndCouponLocationIdIn(Long userId, Collection<Long> locationIds);
}
