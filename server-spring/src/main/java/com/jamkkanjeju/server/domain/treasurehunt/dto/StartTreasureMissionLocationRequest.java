package com.jamkkanjeju.server.domain.treasurehunt.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/** 보물찾기 시작 요청 위치. 최초 시작·재시작 시 보물 좌표를 생성하는 기준이 된다. */
public record StartTreasureMissionLocationRequest(
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude
) {
}
