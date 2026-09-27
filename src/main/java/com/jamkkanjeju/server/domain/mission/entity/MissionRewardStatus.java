package com.jamkkanjeju.server.domain.mission.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;

/**
 * 미션 종류별 *_mission_reward_status 테이블이 공통으로 가지는 보상 지급 여부 플래그.
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

    public void grantArCharacterReward() {
        this.arCharacterRewardGranted = true;
    }

    public void grantPointReward() {
        this.pointRewardGranted = true;
    }

    public void grantCouponReward() {
        this.couponRewardGranted = true;
    }
}
