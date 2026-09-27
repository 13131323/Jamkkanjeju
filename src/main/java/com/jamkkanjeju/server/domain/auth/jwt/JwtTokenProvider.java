package com.jamkkanjeju.server.domain.auth.jwt;

import com.jamkkanjeju.server.domain.auth.config.JwtProperties;
import com.jamkkanjeju.server.domain.auth.entity.User;
import io.jsonwebtoken.Jwts;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** 액세스·리프레시 JWT 생성. Claim 구성은 domain/auth/BUISNESS_RULE.md 3절을 따른다. */
@Component
@RequiredArgsConstructor
public class JwtTokenProvider {

    public static final String CLAIM_ROLE = "role";
    public static final String CLAIM_TYPE = "type";
    public static final String TYPE_ACCESS = "access";
    public static final String TYPE_REFRESH = "refresh";

    private final SecretKey jwtSigningKey;
    private final JwtProperties jwtProperties;
    private final Clock clock;

    public IssuedToken createAccessToken(User user) {
        Instant issuedAt = now();
        Instant expiresAt = issuedAt.plus(jwtProperties.accessTokenExpiration());

        String token = Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim(CLAIM_ROLE, user.getRole().name())
                .claim(CLAIM_TYPE, TYPE_ACCESS)
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .signWith(jwtSigningKey)
                .compact();

        return new IssuedToken(token, issuedAt, expiresAt);
    }

    public IssuedToken createRefreshToken(User user) {
        Instant issuedAt = now();
        Instant expiresAt = issuedAt.plus(jwtProperties.refreshTokenExpiration());

        String token = Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim(CLAIM_TYPE, TYPE_REFRESH)
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .signWith(jwtSigningKey)
                .compact();

        return new IssuedToken(token, issuedAt, expiresAt);
    }

    /** JWT의 iat/exp는 초 단위이므로 응답·DB에 쓰는 시각도 초 단위로 맞춘다. */
    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.SECONDS);
    }
}
