package com.jamkkanjeju.server.domain.mission.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import com.jamkkanjeju.server.domain.auth.entity.User;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.Getter;

/** 사용자와 공통 미션별로 AR 캐릭터·포인트·쿠폰의 누적 지급 여부를 기록한다. */
@Entity
@Getter
@Table(name = "mission_reward_status")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MissionRewardStatus extends BaseTimeEntity {

    @EmbeddedId
    private MissionRewardStatusId id;

    @MapsId("missionId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mission_id", nullable = false)
    private Mission mission;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "ar_character_reward_granted", nullable = false)
    private boolean arCharacterRewardGranted;

    @Column(name = "point_reward_granted", nullable = false)
    private boolean pointRewardGranted;

    @Column(name = "coupon_reward_granted", nullable = false)
    private boolean couponRewardGranted;

    /** 사용자와 미션의 보상 상태를 모든 항목이 미지급인 상태로 생성한다. */
    @Builder
    private MissionRewardStatus(Mission mission, User user) {
        this.id = new MissionRewardStatusId(mission.getId(), user.getId());
        this.mission = mission;
        this.user = user;
    }

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
