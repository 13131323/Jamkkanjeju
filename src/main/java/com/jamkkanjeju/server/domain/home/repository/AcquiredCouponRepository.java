package com.jamkkanjeju.server.domain.home.repository;

import com.jamkkanjeju.server.domain.home.entity.AcquiredCoupon;
import com.jamkkanjeju.server.domain.home.entity.AcquiredCouponId;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 사용자가 획득한 쿠폰 기록을 조회·저장하는 레포지토리이다.
 * 결과: 상속받은 {@code existsById(new AcquiredCouponId(couponId, userId))}는 사용자가 그 쿠폰을 이미 보유했는지 여부이고,
 * {@code save(acquiredCoupon)}는 저장한 획득 기록을 돌려준다. (쿠폰, 사용자)가 PK라 사용자당 같은 쿠폰은 한 건이다.
 * 사용: 문화 미션 진행도 저장({@code PATCH /api/v2/culture-missions/{cultureMissionProgressId}/progress})의 완료 보상으로
 * 쿠폰을 지급할 때, 이미 보유한 쿠폰이면 행을 새로 만들지 않고 없으면 저장한다. 응답의 {@code reward.coupon}을 구성한다.
 */
public interface AcquiredCouponRepository extends JpaRepository<AcquiredCoupon, AcquiredCouponId> {
}
