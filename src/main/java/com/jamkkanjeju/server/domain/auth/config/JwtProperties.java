package com.jamkkanjeju.server.domain.auth.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** JWT 비밀 키와 액세스·리프레시 토큰 유효 기간을 담는 설정이다. */
@Validated
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(
        @NotBlank String secretKey,
        @NotNull Duration accessTokenExpiration,
        @NotNull Duration refreshTokenExpiration
) {

    /** 토큰 유효 기간 설정이 올바른지 검증한다. */
    public JwtProperties {
        validatePositive(accessTokenExpiration, "access-token-expiration");
        validatePositive(refreshTokenExpiration, "refresh-token-expiration");
    }

    /** 유효 기간이 0보다 큰지 확인한다. */
    private static void validatePositive(Duration duration, String propertyName) {
        if (duration != null && (duration.isZero() || duration.isNegative())) {
            throw new IllegalArgumentException("app.jwt." + propertyName + "은 0보다 커야 합니다.");
        }
    }
}
