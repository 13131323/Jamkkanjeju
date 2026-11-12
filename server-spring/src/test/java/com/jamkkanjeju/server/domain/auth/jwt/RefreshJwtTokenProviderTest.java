package com.jamkkanjeju.server.domain.auth.jwt;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.*;
import static org.assertj.core.api.Assertions.*;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Date;
import java.util.stream.Stream;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;

/** 실제 서명 토큰으로 리프레시 Claim·서명·만료 경계를 검증한다. */
class RefreshJwtTokenProviderTest {
    private static final String JTI = "91d682d8-d290-4c90-afd3-069cc39e1a45";
    private final JwtTokenProvider provider = new JwtTokenProvider(SIGNING_KEY, JWT_PROPERTIES, FIXED_CLOCK);

    @Test
    void 발급한_리프레시_토큰에서_사용자를_꺼낸다() {
        assertThat(provider.parseRefreshToken(provider.createRefreshToken(activeUser(7L)).value())).isEqualTo(7L);
    }

    @ParameterizedTest
    @MethodSource("invalidClaims")
    void 잘못된_필수_Claim을_거부한다(String subject, String jti, String type, boolean hasExpiry) {
        String raw = signed(subject, jti, type, hasExpiry ? NOW.plusSeconds(60) : null, SIGNING_KEY);
        assertThatThrownBy(() -> provider.parseRefreshToken(raw)).isInstanceOf(JwtException.class).isNotInstanceOf(ExpiredJwtException.class);
    }

    static Stream<Arguments> invalidClaims() {
        return Stream.of(
                Arguments.of(null, JTI, "refresh", true),
                Arguments.of("0", JTI, "refresh", true),
                Arguments.of("-1", JTI, "refresh", true),
                Arguments.of("abc", JTI, "refresh", true),
                Arguments.of("9223372036854775808", JTI, "refresh", true),
                Arguments.of("7", null, "refresh", true),
                Arguments.of("7", "not-uuid", "refresh", true),
                Arguments.of("7", JTI, "access", true),
                Arguments.of("7", JTI, "refresh", false));
    }

    @ParameterizedTest
    @CsvSource({"-1,false", "0,true", "1,true"})
    void 만료_직전은_허용하고_정각부터_거부한다(long millis, boolean expired) {
        String raw = signed("7", JTI, "refresh", NOW, SIGNING_KEY);
        JwtTokenProvider atBoundary = new JwtTokenProvider(SIGNING_KEY, JWT_PROPERTIES, Clock.fixed(NOW.plusMillis(millis), ZONE));
        if (expired) assertThatThrownBy(() -> atBoundary.parseRefreshToken(raw)).isInstanceOf(ExpiredJwtException.class);
        else assertThat(atBoundary.parseRefreshToken(raw)).isEqualTo(7L);
    }

    @Test
    void 다른_키의_서명을_거부한다() {
        SecretKey otherKey = Keys.hmacShaKeyFor("another-secret-key-for-jwt-signing-32b".getBytes(StandardCharsets.UTF_8));
        assertThatThrownBy(() -> provider.parseRefreshToken(signed("7", JTI, "refresh", NOW.plusSeconds(60), otherKey))).isInstanceOf(JwtException.class);
    }

    @Test
    void 변조한_페이로드를_거부한다() {
        String[] original = signed("7", JTI, "refresh", NOW.plusSeconds(60), SIGNING_KEY).split("\\.");
        String[] other = signed("8", JTI, "refresh", NOW.plusSeconds(60), SIGNING_KEY).split("\\.");
        String tampered = original[0] + "." + other[1] + "." + original[2];
        assertThatThrownBy(() -> provider.parseRefreshToken(tampered)).isInstanceOf(JwtException.class);
    }

    @Test
    void JWT가_아닌_문자열을_거부한다() {
        assertThatThrownBy(() -> provider.parseRefreshToken("not-a-jwt")).isInstanceOf(JwtException.class);
    }

    @Test
    void 만료됐어도_종류가_다르면_유효하지_않은_토큰이다() {
        String raw = signed("7", JTI, "access", NOW.minusSeconds(1), SIGNING_KEY);
        assertThatThrownBy(() -> provider.parseRefreshToken(raw)).isInstanceOf(JwtException.class).isNotInstanceOf(ExpiredJwtException.class);
    }

    private String signed(String subject, String jti, String type, Instant expiration, SecretKey key) {
        return Jwts.builder().subject(subject).id(jti).claim("type", type)
                .issuedAt(Date.from(NOW.minusSeconds(60)))
                .expiration(expiration == null ? null : Date.from(expiration)).signWith(key).compact();
    }
}
