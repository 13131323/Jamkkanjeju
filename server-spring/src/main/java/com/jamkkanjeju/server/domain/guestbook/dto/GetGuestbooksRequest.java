package com.jamkkanjeju.server.domain.guestbook.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

/** 일반·길바닥 방명록의 페이지 조건을 각각 전달한다. */
public record GetGuestbooksRequest(
        @PositiveOrZero @Schema(defaultValue = "0") Integer generalPage,
        @Positive @Schema(defaultValue = "10") Integer generalSize,
        @PositiveOrZero @Schema(defaultValue = "0") Integer roadPage,
        @Positive @Schema(defaultValue = "10") Integer roadSize
) {

    /** 생략한 페이지·크기는 유형별로 독립적으로 0·10을 적용한다. */
    public GetGuestbooksRequest {
        generalPage = generalPage == null ? 0 : generalPage;
        generalSize = generalSize == null ? 10 : generalSize;
        roadPage = roadPage == null ? 0 : roadPage;
        roadSize = roadSize == null ? 10 : roadSize;
    }
}
