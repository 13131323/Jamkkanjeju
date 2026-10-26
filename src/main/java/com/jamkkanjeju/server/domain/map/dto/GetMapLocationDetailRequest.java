package com.jamkkanjeju.server.domain.map.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

/** 장소 상세 조회의 실제 사용자 좌표와 방명록 페이지 조건이다. */
public record GetMapLocationDetailRequest(
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double userLatitude,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double userLongitude,
        @PositiveOrZero @Schema(defaultValue = "0") Integer page,
        @Positive @Schema(defaultValue = "20") Integer size
) {

    /** 생략한 페이지는 첫 페이지, 생략한 페이지 크기는 20으로 지정한다. */
    public GetMapLocationDetailRequest {
        page = page == null ? 0 : page;
        size = size == null ? 20 : size;
    }
}
