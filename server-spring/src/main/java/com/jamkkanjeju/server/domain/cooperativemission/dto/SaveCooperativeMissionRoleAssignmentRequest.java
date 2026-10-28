package com.jamkkanjeju.server.domain.cooperativemission.dto;

import com.jamkkanjeju.server.common.config.StrictLongDeserializer;
import jakarta.validation.constraints.NotNull;
import tools.jackson.databind.annotation.JsonDeserialize;

/** 방장이 역할 카드를 배정할 팀 참가자 ID를 전달하는 요청이다. */
public record SaveCooperativeMissionRoleAssignmentRequest(
        @NotNull @JsonDeserialize(using = StrictLongDeserializer.class) Long participantId
) {
}
