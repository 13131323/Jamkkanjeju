package com.jamkkanjeju.server.reward.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import com.jamkkanjeju.server.user.entity.User;
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

/** 사용자가 획득한 쿠폰 (PK: coupon_id, user_id) */
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

    @Builder
    private AcquiredCoupon(Coupon coupon, User user, LocalDateTime acquiredAt) {
        this.id = new AcquiredCouponId(coupon.getId(), user.getId());
        this.coupon = coupon;
        this.user = user;
        this.acquiredAt = acquiredAt;
    }
}
