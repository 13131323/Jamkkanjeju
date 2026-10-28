package com.jamkkanjeju.server.domain.cooperativemission.entity;

import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import com.jamkkanjeju.server.domain.map.entity.Location;
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

/**
 * 팀원이 역할을 나눠 함께 수행하는 협동 미션의 장소, 활성화 상태, 완료 보상을 담는다.
 * 공통 미션({@link Mission})과 PK 를 공유한다.
 */
@Entity
@Getter
@Table(name = "cooperative_mission")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CooperativeMission extends BaseTimeEntity {

    @Id
    @Column(name = "mission_id")
    private Long missionId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mission_id", nullable = false)
    private Mission mission;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id")
    private Location location;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private MissionActivationStatus status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ar_character_id")
    private ArCharacter arCharacter;

    @Column(name = "point")
    private Integer point;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coupon_id")
    private Coupon coupon;

    /** 공통 미션에 연결된 협동 미션을 장소·활성화 상태·보상과 함께 생성한다. */
    @Builder
    private CooperativeMission(Mission mission, Location location, MissionActivationStatus status,
                               ArCharacter arCharacter, Integer point, Coupon coupon) {
        this.mission = mission;
        this.location = location;
        this.status = status;
        this.arCharacter = arCharacter;
        this.point = point;
        this.coupon = coupon;
    }

    /** 협동 미션의 활성화 상태를 변경한다. */
    public void changeStatus(MissionActivationStatus status) {
        this.status = status;
    }
}
