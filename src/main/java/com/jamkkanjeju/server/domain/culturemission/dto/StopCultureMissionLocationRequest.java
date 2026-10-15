package com.jamkkanjeju.server.domain.culturemission.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/** 문화 미션 중단 시 다음 장소 추천과 거리 계산에 사용하는 요청 위치이다. */
public record StopCultureMissionLocationRequest(
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude
) {
}
