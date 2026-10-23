package com.jamkkanjeju.server.domain.map.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/** 회전 없는 지도 화면의 두 꼭짓점과 실제 사용자 위치·응답 구분을 전달한다. */
public record GetMapContentsRequest(
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double leftTopLatitude,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double leftTopLongitude,
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double rightBottomLatitude,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double rightBottomLongitude,
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double userLatitude,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double userLongitude,
        @NotNull Boolean isClustered
) {

    /** 좌표에 NaN이나 무한대가 없는지 확인한다. 누락은 각 필드의 필수 검증에서 처리한다. */
    @AssertTrue
    @JsonIgnore
    @Schema(hidden = true)
    public boolean isFiniteCoordinates() {
        return isFiniteOrNull(leftTopLatitude) && isFiniteOrNull(leftTopLongitude)
                && isFiniteOrNull(rightBottomLatitude) && isFiniteOrNull(rightBottomLongitude)
                && isFiniteOrNull(userLatitude) && isFiniteOrNull(userLongitude);
    }

    /** 두 꼭짓점이 올바른 방향과 양수 너비·높이를 가진 사각형인지 확인한다. */
    @AssertTrue
    @JsonIgnore
    @Schema(hidden = true)
    public boolean isValidViewport() {
        if (leftTopLatitude == null || leftTopLongitude == null
                || rightBottomLatitude == null || rightBottomLongitude == null) {
            return true;
        }
        return leftTopLatitude > rightBottomLatitude && leftTopLongitude < rightBottomLongitude;
    }

    /** 필수 검증과 별개로 값이 있는 좌표의 유한성만 확인한다. */
    private static boolean isFiniteOrNull(Double value) {
        return value == null || Double.isFinite(value);
    }
}
