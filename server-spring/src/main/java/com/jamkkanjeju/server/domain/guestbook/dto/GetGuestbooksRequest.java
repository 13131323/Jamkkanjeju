package com.jamkkanjeju.server.domain.guestbook.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

/** 방명록 유형·조회 기준과 유형별 페이지 조건을 전달한다. */
public record GetGuestbooksRequest(
        @PositiveOrZero @Schema(defaultValue = "0") Integer generalPage,
        @Positive @Max(10) @Schema(defaultValue = "10") Integer generalSize,
        @PositiveOrZero @Schema(defaultValue = "0") Integer roadPage,
        @Positive @Max(10) @Schema(defaultValue = "10") Integer roadSize,
        @Pattern(regexp = "ALL|GENERAL|ROAD")
        @Schema(defaultValue = "ALL", allowableValues = {"ALL", "GENERAL", "ROAD"}) String guestbookType,
        @Pattern(regexp = "LATEST|POPULAR|MINE|LIKED")
        @Schema(defaultValue = "LATEST", allowableValues = {"LATEST", "POPULAR", "MINE", "LIKED"}) String sort
) {

    /** 생략한 페이지·크기는 0·10, 필터는 전체·최신순을 적용한다. */
    public GetGuestbooksRequest {
        generalPage = generalPage == null ? 0 : generalPage;
        generalSize = generalSize == null ? 10 : generalSize;
        roadPage = roadPage == null ? 0 : roadPage;
        roadSize = roadSize == null ? 10 : roadSize;
        guestbookType = guestbookType == null ? "ALL" : guestbookType;
        sort = sort == null ? "LATEST" : sort;
    }
}
