package com.jamkkanjeju.server.domain.treasurehunt.entity;

import com.jamkkanjeju.server.domain.mission.entity.Mission;

import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatus;
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
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 사용자가 보물찾기 미션 보상을 받았는지 나타내는 지급 기록이다. 미션과 사용자 조합당 한 건이다. */
@Entity
@Getter
@Table(name = "treasure_mission_reward_status")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TreasureMissionRewardStatus extends MissionRewardStatus {

    @EmbeddedId
    private TreasureMissionRewardStatusId id;

    @MapsId("treasureMissionId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "treasure_mission_id", nullable = false)
    private TreasureMission treasureMission;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** 사용자의 보물찾기 미션 보상 지급 기록을 생성한다. */
    @Builder
    private TreasureMissionRewardStatus(TreasureMission treasureMission, User user) {
        this.id = new TreasureMissionRewardStatusId(treasureMission.getMissionId(), user.getId());
        this.treasureMission = treasureMission;
        this.user = user;
    }
}
