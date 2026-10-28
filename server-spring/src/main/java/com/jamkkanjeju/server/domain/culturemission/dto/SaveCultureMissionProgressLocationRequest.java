package com.jamkkanjeju.server.domain.culturemission.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/** 문화 미션 진행도 저장 요청 위치. 완료 시 다음 장소를 추천하고 거리를 계산하는 기준이 된다. */
public record SaveCultureMissionProgressLocationRequest(
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude
) {
}
