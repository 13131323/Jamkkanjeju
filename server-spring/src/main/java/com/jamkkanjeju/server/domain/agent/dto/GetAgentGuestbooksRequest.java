package com.jamkkanjeju.server.domain.agent.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;

/** 에이전트의 장소 방명록 조회 페이지 조건이다. */
public record GetAgentGuestbooksRequest(
        @PositiveOrZero @Schema(defaultValue = "0") Integer page,
        @Positive @Max(100) @Schema(defaultValue = "100") Integer size,
        @Size(min = 1, max = 100) List<@NotNull @Positive Long> guestbookIds
) {
    /** 기존 전체 조회의 호출 계약을 유지한다. */
    public GetAgentGuestbooksRequest(Integer page, Integer size) {
        this(page, size, null);
    }

    /** 생략한 페이지·크기를 0·100으로 지정한다. */
    public GetAgentGuestbooksRequest {
        page = page == null ? 0 : page;
        size = size == null ? 100 : size;
    }
}
