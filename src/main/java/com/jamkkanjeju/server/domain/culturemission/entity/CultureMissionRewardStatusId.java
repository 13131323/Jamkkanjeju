package com.jamkkanjeju.server.domain.culturemission.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 문화 미션 보상 지급 상태를 사용자와 문화 미션으로 식별하는 복합 키이다. */
@Embeddable
@Getter
@EqualsAndHashCode
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class CultureMissionRewardStatusId implements Serializable {

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "culture_mission_id")
    private Long cultureMissionId;
}
