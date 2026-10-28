package com.jamkkanjeju.server.domain.cooperativemission.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/** 협동 미션 상태 조회 시 완료 후 다음 장소 추천과 거리 계산에 사용할 현재 좌표이다. */
public record GetCooperativeMissionStatusRequest(
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude
) {
}
