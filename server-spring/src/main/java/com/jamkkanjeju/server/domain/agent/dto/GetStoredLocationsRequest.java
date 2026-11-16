package com.jamkkanjeju.server.domain.agent.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

/** 에이전트의 저장 장소 조회 페이지 조건이다. */
public record GetStoredLocationsRequest(
        @PositiveOrZero @Schema(defaultValue = "0") Integer page,
        @Positive @Max(100) @Schema(defaultValue = "100") Integer size
) {
    /** 생략한 페이지·크기를 0·100으로 지정한다. */
    public GetStoredLocationsRequest {
        page = page == null ? 0 : page;
        size = size == null ? 100 : size;
    }
}
