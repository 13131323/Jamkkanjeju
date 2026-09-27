package com.jamkkanjeju.server.domain.auth.support;

import com.jamkkanjeju.server.domain.auth.config.JwtProperties;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.entity.UserRole;
import com.jamkkanjeju.server.domain.auth.entity.UserStatus;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Base64;
import javax.crypto.SecretKey;
import org.springframework.test.util.ReflectionTestUtils;

/** 단위 테스트에서 공통으로 쓰는 고정 시각·JWT 설정·사용자 생성 도우미 */
public final class AuthFixtures {

    public static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    public static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");
    public static final Clock FIXED_CLOCK = Clock.fixed(NOW, ZONE);

    public static final String SECRET_KEY_BASE64 = Base64.getEncoder()
            .encodeToString("test-secret-key-for-jwt-signing-32bytes!".getBytes(StandardCharsets.UTF_8));
    public static final SecretKey SIGNING_KEY = Keys.hmacShaKeyFor(Base64.getDecoder().decode(SECRET_KEY_BASE64));
    public static final JwtProperties JWT_PROPERTIES =
            new JwtProperties(SECRET_KEY_BASE64, Duration.ofMinutes(30), Duration.ofDays(14));

    private AuthFixtures() {
    }

    public static User user(Long id, UserRole role, UserStatus status) {
        User user = User.builder()
                .email("user@example.com")
                .passwordHash("{bcrypt-hash}")
                .nickname("몽글몽글파도")
                .role(role)
                .status(status)
                .build();
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    public static User activeUser(Long id) {
        return user(id, UserRole.USER, UserStatus.ACTIVE);
    }
}
