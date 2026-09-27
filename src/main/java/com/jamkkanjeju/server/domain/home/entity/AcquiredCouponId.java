package com.jamkkanjeju.server.domain.home.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Embeddable     // 이 클래스의 필드들을 다른 엔티티에 포함해서 매핑할 수 있다는 뜻
@Getter
@EqualsAndHashCode          // equals, hashCode 메서드 자동 생성
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class AcquiredCouponId implements Serializable {     // 복합키 클래스에서 java 객체의 직렬화 표시하는 마커 인터페이스

    @Column(name = "coupon_id")
    private Long couponId;

    @Column(name = "user_id")
    private Long userId;
}
