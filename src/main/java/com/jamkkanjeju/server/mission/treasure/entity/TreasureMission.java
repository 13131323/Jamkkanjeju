package com.jamkkanjeju.server.mission.treasure.entity;

import com.jamkkanjeju.server.character.entity.ArCharacter;
import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import com.jamkkanjeju.server.location.entity.Location;
import com.jamkkanjeju.server.mission.common.entity.Mission;
import com.jamkkanjeju.server.mission.common.entity.MissionActivationStatus;
import com.jamkkanjeju.server.reward.entity.Coupon;
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

/** mission 과 PK(mission_id)를 공유하는 보물찾기 미션 상세 */
@Entity
@Getter
@Table(name = "treasure_mission")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TreasureMission extends BaseTimeEntity {

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

    /** 찾아야 하는 아이템 총 개수 */
    @Column(name = "item_total_count", nullable = false)
    private int itemTotalCount;

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

    @Builder
    private TreasureMission(Mission mission, Location location, int itemTotalCount,
                            MissionActivationStatus status, ArCharacter arCharacter,
                            Integer point, Coupon coupon) {
        this.mission = mission;
        this.location = location;
        this.itemTotalCount = itemTotalCount;
        this.status = status;
        this.arCharacter = arCharacter;
        this.point = point;
        this.coupon = coupon;
    }

    public void changeStatus(MissionActivationStatus status) {
        this.status = status;
    }
}
