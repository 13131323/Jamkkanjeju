package com.jamkkanjeju.server.domain.cooperativemission.entity;

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
public class CooperativeMissionRewardStatusId implements Serializable {

    @Column(name = "cooperative_mission_id")
    private Long cooperativeMissionId;

    @Column(name = "user_id")
    private Long userId;
}
