package com.jamkkanjeju.server.domain.home.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/** 홈 조회 요청 위치. 현재 위치 또는 사용자가 선택한 위치이며, 미션까지의 거리를 계산하는 기준이 된다. */
public record GetHomeRequest(
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude
) {
}
