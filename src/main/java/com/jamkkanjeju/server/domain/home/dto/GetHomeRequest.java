package com.jamkkanjeju.server.domain.home.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

/**
 * 홈 조회 요청 Query. 현재 위치 또는 사용자가 선택한 위치의 좌표이며 거리 계산의 기준 위치가 된다.
 * 누락·범위 초과는 Bean Validation에서, 숫자로 바꿀 수 없는 값은 바인딩 단계에서 실패해 INVALID_REQUEST로 응답된다.
 */
public record GetHomeRequest(
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double latitude,
        @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") Double longitude
) {
}
