package com.jamkkanjeju.server.domain.culturemission.entity;

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

/** 사용자가 문화 미션 완료 보상을 받았는지 기록하는 보상 지급 상태이다. 사용자와 문화 미션 쌍으로 식별한다. */
@Entity
@Getter
@Table(name = "culture_mission_reward_status")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CultureMissionRewardStatus extends MissionRewardStatus {

    @EmbeddedId
    private CultureMissionRewardStatusId id;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @MapsId("cultureMissionId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "culture_mission_id", nullable = false)
    private CultureMission cultureMission;

    /** 사용자의 문화 미션 보상 지급 상태를 아직 아무 보상도 받지 않은 상태로 생성한다. */
    @Builder
    private CultureMissionRewardStatus(User user, CultureMission cultureMission) {
        this.id = new CultureMissionRewardStatusId(user.getId(), cultureMission.getMissionId());
        this.user = user;
        this.cultureMission = cultureMission;
    }
}
