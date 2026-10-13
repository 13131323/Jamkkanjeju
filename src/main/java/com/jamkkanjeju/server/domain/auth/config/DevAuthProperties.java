package com.jamkkanjeju.server.domain.auth.config;

import com.jamkkanjeju.server.domain.auth.entity.UserRole;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** 개발 편의용 자동 로그인의 사용 여부와 대신 인증할 사용자를 담는 설정이다. */
// 켜져 있으면 토큰 없이 호출해도 지정한 사용자로 인증된 것처럼 동작한다. (Swagger에서 매번 Authorize 하지 않고 API를 만들어 볼 때 쓴다.)
// 운영에서는 절대 켜지 않는다. 기본값은 꺼짐이고, 로컬에서만 DEV_AUTH_ENABLED=true로 켠다.
@Validated
@ConfigurationProperties(prefix = "app.dev-auth")
public record DevAuthProperties(
        boolean enabled,
        @NotNull @Positive Long userId,
        @NotNull UserRole role
) {
}
