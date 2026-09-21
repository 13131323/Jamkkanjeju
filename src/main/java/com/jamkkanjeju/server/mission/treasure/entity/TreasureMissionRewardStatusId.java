package com.jamkkanjeju.server.mission.treasure.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Embeddable
@Getter
@EqualsAndHashCode
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class TreasureMissionRewardStatusId implements Serializable {

    @Column(name = "treasure_mission_id")
    private Long treasureMissionId;

    @Column(name = "user_id")
    private Long userId;
}
