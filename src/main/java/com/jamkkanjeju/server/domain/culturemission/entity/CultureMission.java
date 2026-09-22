package com.jamkkanjeju.server.domain.culturemission.entity;

import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.home.entity.Coupon;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** mission 과 PK(mission_id)를 공유하는 문화 미션 상세 */
@Entity
@Getter
@Table(name = "culture_mission")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CultureMission extends BaseTimeEntity {

    @Id
    @Column(name = "mission_id")
    private Long missionId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mission_id", nullable = false)
    private Mission mission;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private MissionActivationStatus status;

    /** 보상 AR 캐릭터 (없으면 null) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ar_character_id")
    private ArCharacter arCharacter;

    /** 보상 포인트 (없으면 null) */
    @Column(name = "point")
    private Integer point;

    /** 보상 쿠폰 (없으면 null) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coupon_id")
    private Coupon coupon;

    @Builder
    private CultureMission(Mission mission, MissionActivationStatus status,
                           ArCharacter arCharacter, Integer point, Coupon coupon) {
        this.mission = mission;
        this.status = status;
        this.arCharacter = arCharacter;
        this.point = point;
        this.coupon = coupon;
    }

    public void changeStatus(MissionActivationStatus status) {
        this.status = status;
    }
}
