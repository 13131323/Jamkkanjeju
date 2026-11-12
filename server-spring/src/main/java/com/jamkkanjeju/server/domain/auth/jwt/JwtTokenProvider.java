package com.jamkkanjeju.server.domain.auth.jwt;

import com.jamkkanjeju.server.domain.auth.config.JwtProperties;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.entity.UserRole;
import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** 액세스·리프레시 토큰을 발급하고 각 용도에 맞게 검증한다. */
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

    /** 사용자의 액세스 토큰을 발급한다. */
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

    /** 사용자의 리프레시 토큰을 발급한다. */
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

    /**
     * 액세스 토큰을 검증하고 인증된 사용자 정보를 꺼낸다.
     *
     * @throws io.jsonwebtoken.ExpiredJwtException 만료된 토큰
     * @throws JwtException 서명 불일치, 형식 오류, 액세스 토큰이 아닌 경우 등 그 밖의 검증 실패
     */
    public AuthUser parseAccessToken(String token) {
        Claims claims = parseSignedToken(token).getPayload();

        if (!TYPE_ACCESS.equals(claims.get(CLAIM_TYPE, String.class))) {
            throw new JwtException("액세스 토큰이 아닙니다.");
        }

        try {
            Long userId = Long.valueOf(claims.getSubject());
            UserRole role = UserRole.valueOf(claims.get(CLAIM_ROLE, String.class));
            return new AuthUser(userId, role);
        } catch (RuntimeException exception) {
            throw new JwtException("액세스 토큰의 Claim이 올바르지 않습니다.", exception);
        }
    }

    /**
     * 리프레시 토큰의 서명·종류·필수 Claim·만료를 검증하고 사용자 ID를 반환한다.
     * 저장 기록의 존재·폐기 여부는 재발급 서비스에서 별도로 확인한다.
     *
     * @throws ExpiredJwtException 만료된 리프레시 토큰
     * @throws JwtException 서명·종류·필수 Claim이 올바르지 않은 토큰
     */
    public Long parseRefreshToken(String token) {
        Jws<Claims> signedToken;
        try {
            signedToken = parseSignedToken(token);
        } catch (ExpiredJwtException exception) {
            // 파서가 만료를 먼저 감지해도 종류·필수 Claim이 잘못된 토큰은 INVALID_TOKEN 대상이다.
            refreshUserId(exception.getClaims());
            throw exception;
        }

        Claims claims = signedToken.getPayload();
        Long userId = refreshUserId(claims);
        // JWT 파서의 경계 처리와 관계없이 만료 시각과 현재 시각이 같으면 만료로 판정한다.
        if (!claims.getExpiration().toInstant().isAfter(clock.instant())) {
            throw new ExpiredJwtException(signedToken.getHeader(), claims, "만료된 리프레시 토큰입니다.");
        }
        return userId;
    }

    /** 같은 서명 키와 시각 기준으로 JWT를 검증한다. */
    private Jws<Claims> parseSignedToken(String token) {
        return Jwts.parser()
                .verifyWith(jwtSigningKey)
                .clock(() -> Date.from(clock.instant()))
                .build()
                .parseSignedClaims(token);
    }

    /** 리프레시 토큰의 필수 Claim을 검증한다. 토큰 값은 예외 메시지에 포함하지 않는다. */
    private Long refreshUserId(Claims claims) {
        try {
            if (!TYPE_REFRESH.equals(claims.get(CLAIM_TYPE, String.class)) || claims.getExpiration() == null) {
                throw new IllegalArgumentException();
            }
            Long userId = Long.valueOf(claims.getSubject());
            String tokenId = claims.getId();
            if (userId <= 0 || tokenId == null || !UUID.fromString(tokenId).toString().equals(tokenId)) {
                throw new IllegalArgumentException();
            }
            return userId;
        } catch (RuntimeException exception) {
            throw new JwtException("리프레시 토큰의 Claim이 올바르지 않습니다.");
        }
    }

    /** 토큰 발급 기준 현재 시각을 구한다. */
    private Instant now() {
        // JWT의 iat/exp는 초 단위이므로 응답·DB에 쓰는 시각도 초 단위로 맞춘다.
        return clock.instant().truncatedTo(ChronoUnit.SECONDS);
    }
}
