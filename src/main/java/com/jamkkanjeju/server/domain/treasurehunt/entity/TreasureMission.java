package com.jamkkanjeju.server.domain.treasurehunt.entity;

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
 * 보물찾기(AR 캐릭터) 미션의 장소, 찾아야 할 보물 수, 보상, 활성화 상태를 담는 미션 상세이다.
 * 공통 미션({@link Mission})과 PK를 공유한다.
 */
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

    /** 보물찾기 미션 상세를 생성한다. */
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

    /** 보물찾기 미션의 활성화 상태(ACTIVE/INACTIVE)를 변경한다. */
    public void changeStatus(MissionActivationStatus status) {
        this.status = status;
    }
}
