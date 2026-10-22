package com.jamkkanjeju.server.domain.cooperativemission.dto;

import com.jamkkanjeju.server.common.config.StrictIntegerDeserializer;
import jakarta.validation.constraints.NotNull;
import tools.jackson.databind.annotation.JsonDeserialize;

/** 방장이 협동 미션을 변경하려는 다음 단계를 전달하는 요청이다. */
public record SaveCooperativeMissionProgressRequest(
        @NotNull @JsonDeserialize(using = StrictIntegerDeserializer.class) Integer currentStep
) {
}
