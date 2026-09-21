package com.jamkkanjeju.server.mission.treasure.entity;

import com.jamkkanjeju.server.mission.common.entity.MissionRewardStatus;
import com.jamkkanjeju.server.user.entity.User;
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

/** 보물찾기 미션 보상 지급 여부 (PK: treasure_mission_id, user_id) */
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

    @Builder
    private TreasureMissionRewardStatus(TreasureMission treasureMission, User user) {
        this.id = new TreasureMissionRewardStatusId(treasureMission.getMissionId(), user.getId());
        this.treasureMission = treasureMission;
        this.user = user;
    }
}
