package com.jamkkanjeju.server.domain.mission.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;

/**
 * 사용자가 미션 보상(AR 캐릭터·포인트·쿠폰)을 받았는지 기록하는 미션 종류별 보상 지급 상태의 공통 부모이다.
 * 복합 PK 는 컬럼 순서가 테이블마다 달라 각 엔티티에서 EmbeddedId 로 선언한다.
 */
@Getter
@MappedSuperclass
public abstract class MissionRewardStatus extends BaseTimeEntity {

    @Column(name = "ar_character_reward_granted", nullable = false)
    private boolean arCharacterRewardGranted;

    @Column(name = "point_reward_granted", nullable = false)
    private boolean pointRewardGranted;

    @Column(name = "coupon_reward_granted", nullable = false)
    private boolean couponRewardGranted;

    /** AR 캐릭터 보상을 지급한 것으로 기록한다. */
    public void grantArCharacterReward() {
        this.arCharacterRewardGranted = true;
    }

    /** 포인트 보상을 지급한 것으로 기록한다. */
    public void grantPointReward() {
        this.pointRewardGranted = true;
    }

    /** 쿠폰 보상을 지급한 것으로 기록한다. */
    public void grantCouponReward() {
        this.couponRewardGranted = true;
    }
}
