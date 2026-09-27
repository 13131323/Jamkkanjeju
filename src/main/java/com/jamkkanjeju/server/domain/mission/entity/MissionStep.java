package com.jamkkanjeju.server.domain.mission.entity;

import com.fasterxml.jackson.annotation.JsonProperty;

/** mission_type.steps JSON 배열의 원소 */
public record MissionStep(
        @JsonProperty("step") int step,
        @JsonProperty("step_title") String stepTitle,
        @JsonProperty("description") String description
) {
}
