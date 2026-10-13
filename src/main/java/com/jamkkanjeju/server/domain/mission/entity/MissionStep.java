package com.jamkkanjeju.server.domain.mission.entity;

import com.fasterxml.jackson.annotation.JsonProperty;

/** 미션 유형의 진행 방법을 단계별로 안내하는 한 단계(번호·제목·설명)이다. */
public record MissionStep(
        @JsonProperty("step") int step,
        @JsonProperty("step_title") String stepTitle,
        @JsonProperty("description") String description
) {
}
