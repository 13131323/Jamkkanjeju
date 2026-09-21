package com.jamkkanjeju.server.mission.cooperative.entity;

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

/** 협동 미션 보상 지급 여부 (PK: cooperative_mission_id, user_id) */
@Entity
@Getter
@Table(name = "cooperative_mission_reward_status")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CooperativeMissionRewardStatus extends MissionRewardStatus {

    @EmbeddedId
    private CooperativeMissionRewardStatusId id;

    @MapsId("cooperativeMissionId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cooperative_mission_id", nullable = false)
    private CooperativeMission cooperativeMission;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Builder
    private CooperativeMissionRewardStatus(CooperativeMission cooperativeMission, User user) {
        this.id = new CooperativeMissionRewardStatusId(
                cooperativeMission.getMissionId(), user.getId());
        this.cooperativeMission = cooperativeMission;
        this.user = user;
    }
}
