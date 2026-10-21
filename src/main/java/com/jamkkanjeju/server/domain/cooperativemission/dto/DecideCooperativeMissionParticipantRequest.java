package com.jamkkanjeju.server.domain.cooperativemission.dto;

import jakarta.validation.constraints.NotNull;

/** 방장이 협동 미션 참여 요청을 수락하거나 거절할 때 처리 결정을 담는다. */
public record DecideCooperativeMissionParticipantRequest(
        @NotNull Decision decision
) {

    /** 협동 미션 참여 요청에 적용할 수락 또는 거절 결정이다. */
    public enum Decision {
        ACCEPT,
        REJECT
    }
}
