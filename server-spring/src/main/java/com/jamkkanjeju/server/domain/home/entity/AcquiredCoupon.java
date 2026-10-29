package com.jamkkanjeju.server.domain.home.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import com.jamkkanjeju.server.domain.auth.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 사용자의 쿠폰 획득 기록과 사용 시각이다. 쿠폰과 사용자 조합당 한 건이다. */
@Entity
@Getter
@Table(name = "acquired_coupon")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AcquiredCoupon extends BaseTimeEntity {

    @EmbeddedId
    private AcquiredCouponId id;

    @MapsId("couponId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "coupon_id", nullable = false)
    private Coupon coupon;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "acquired_at", nullable = false)
    private LocalDateTime acquiredAt;

    /** 쿠폰 사용 시각. 미사용이면 null이다. */
    @Column(name = "used_at")
    private LocalDateTime usedAt;

    /** 사용자의 쿠폰 획득 기록을 생성한다. */
    @Builder
    private AcquiredCoupon(Coupon coupon, User user, LocalDateTime acquiredAt, LocalDateTime usedAt) {
        this.id = new AcquiredCouponId(coupon.getId(), user.getId());
        this.coupon = coupon;
        this.user = user;
        this.acquiredAt = acquiredAt;
        this.usedAt = usedAt;
    }
}
