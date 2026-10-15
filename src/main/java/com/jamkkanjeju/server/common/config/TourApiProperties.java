package com.jamkkanjeju.server.common.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** 여러 도메인에서 사용하는 TourAPI 접속 정보와 공통 요청값을 담는 설정이다. */
@Validated
@ConfigurationProperties(prefix = "app.tour-api")
public record TourApiProperties(
        @NotBlank String baseUrl,
        // 인증키 미설정 시에도 앱은 기동하며, 이미지 조회 실패 처리는 호출 컴포넌트에서 담당한다.
        String serviceKey,
        @NotBlank String mobileOs,
        @NotBlank String mobileApp,
        @NotNull Duration connectTimeout,
        @NotNull Duration readTimeout
) {
}
