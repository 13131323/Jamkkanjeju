package com.jamkkanjeju.server.domain.map.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

/** 장소 이름 검색어와 실제 사용자 좌표·페이지 조건을 전달한다. */
public record GetMapSearchRequest(
        @NotBlank String keyword,
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double userLatitude,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double userLongitude,
        @PositiveOrZero @Schema(defaultValue = "0") Integer page,
        @Positive @Schema(defaultValue = "20") Integer size
) {

    /** 검색어 앞뒤 공백만 제거하고 생략한 페이지·크기는 0·20으로 지정한다. */
    public GetMapSearchRequest {
        if (keyword != null) {
            keyword = keyword.strip();
        }
        page = page == null ? 0 : page;
        size = size == null ? 20 : size;
    }
}
