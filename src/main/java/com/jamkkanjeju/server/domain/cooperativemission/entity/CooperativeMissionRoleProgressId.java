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
public class CooperativeMissionRoleProgressId implements Serializable {

    @Column(name = "cooperative_mission_participant_id")
    private Long cooperativeMissionParticipantId;

    @Column(name = "cooperative_role_card_id")
    private Long cooperativeRoleCardId;
}
