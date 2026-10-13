package com.jamkkanjeju.server.domain.treasurehunt.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 보물찾기 미션 보상 지급 기록을 미션과 사용자로 식별하는 복합 키이다. */
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
