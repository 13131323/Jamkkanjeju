package com.jamkkanjeju.server.domain.auth.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(
        @NotBlank String secretKey,
        @NotNull Duration accessTokenExpiration,
        @NotNull Duration refreshTokenExpiration
) {

    public JwtProperties {
        validatePositive(accessTokenExpiration, "access-token-expiration");
        validatePositive(refreshTokenExpiration, "refresh-token-expiration");
    }

    private static void validatePositive(Duration duration, String propertyName) {
        if (duration != null && (duration.isZero() || duration.isNegative())) {
            throw new IllegalArgumentException("app.jwt." + propertyName + "은 0보다 커야 합니다.");
        }
    }
}
