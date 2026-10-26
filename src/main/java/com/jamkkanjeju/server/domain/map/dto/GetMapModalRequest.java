package com.jamkkanjeju.server.domain.map.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

/** 지도에서 선택한 대상 유형·ID와 실제 사용자 좌표를 전달한다. */
public record GetMapModalRequest(
        @NotNull @Pattern(regexp = "LOCATION|ROAD_GUESTBOOK")
        @Schema(allowableValues = {"LOCATION", "ROAD_GUESTBOOK"}) String targetType,
        @NotNull @Positive Long targetId,
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double userLatitude,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double userLongitude
) {
}
