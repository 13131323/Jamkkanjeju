package com.jamkkanjeju.server.domain.etc.repository;

import com.jamkkanjeju.server.domain.home.entity.Coupon;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 결과: 기본 existsById는 쿠폰 정의의 존재 여부를 반환하며 연관 엔티티를 로딩하지 않는다.
 * 사용: 쿠폰 사용 처리({@code PATCH /api/v2/coupons/{couponId}/use})에서 쿠폰 없음과 미획득을 구분한다.
 */
public interface CouponRepository extends JpaRepository<Coupon, Long> {
}
