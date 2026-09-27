package com.jamkkanjeju.server.domain.auth.jwt;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.FIXED_CLOCK;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.JWT_PROPERTIES;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.NOW;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.SIGNING_KEY;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.ZONE;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.user;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jamkkanjeju.server.domain.auth.entity.UserRole;
import com.jamkkanjeju.server.domain.auth.entity.UserStatus;
import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.util.Date;
import org.junit.jupiter.api.Test;

class JwtTokenProviderTest {

    private final JwtTokenProvider jwtTokenProvider = new JwtTokenProvider(SIGNING_KEY, JWT_PROPERTIES, FIXED_CLOCK);

    @Test
    void 액세스_토큰은_sub_role_type_iat_exp_Claim을_가진다() {
        IssuedToken token = jwtTokenProvider.createAccessToken(user(15L, UserRole.ADMIN, UserStatus.ACTIVE));

        Claims claims = parse(token.value());

        assertThat(claims.getSubject()).isEqualTo("15");
        assertThat(claims.get("role", String.class)).isEqualTo("ADMIN");
        assertThat(claims.get("type", String.class)).isEqualTo("access");
        assertThat(claims.getIssuedAt().toInstant()).isEqualTo(NOW);
        assertThat(claims.getExpiration().toInstant()).isEqualTo(NOW.plus(Duration.ofMinutes(30)));
        assertThat(claims.getId()).isNull();
    }

    @Test
    void 액세스_토큰의_발급_만료_시각은_설정된_유효기간을_따른다() {
        IssuedToken token = jwtTokenProvider.createAccessToken(activeUser(1L));

        assertThat(token.issuedAt()).isEqualTo(NOW);
        assertThat(token.expiresAt()).isEqualTo(NOW.plusSeconds(1800));
    }

    @Test
    void 리프레시_토큰은_sub_type_jti_iat_exp_Claim을_가지고_role은_없다() {
        IssuedToken token = jwtTokenProvider.createRefreshToken(activeUser(15L));

        Claims claims = parse(token.value());

        assertThat(claims.getSubject()).isEqualTo("15");
        assertThat(claims.get("type", String.class)).isEqualTo("refresh");
        assertThat(claims.getId()).matches("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");
        assertThat(claims.get("role")).isNull();
        assertThat(claims.getExpiration().toInstant()).isEqualTo(NOW.plus(Duration.ofDays(14)));
    }

    @Test
    void 같은_사용자가_같은_시각에_발급해도_리프레시_토큰의_jti는_서로_다르다() {
        IssuedToken first = jwtTokenProvider.createRefreshToken(activeUser(15L));
        IssuedToken second = jwtTokenProvider.createRefreshToken(activeUser(15L));

        assertThat(parse(first.value()).getId()).isNotEqualTo(parse(second.value()).getId());
        assertThat(first.value()).isNotEqualTo(second.value());
    }

    @Test
    void 발급_시각은_초_단위로_잘라서_사용한다() {
        Clock clockWithMillis = Clock.fixed(NOW.plusMillis(999), ZONE);
        JwtTokenProvider provider = new JwtTokenProvider(SIGNING_KEY, JWT_PROPERTIES, clockWithMillis);

        IssuedToken token = provider.createAccessToken(activeUser(1L));

        assertThat(token.issuedAt()).isEqualTo(NOW);
    }

    @Test
    void 유효한_액세스_토큰에서_사용자_ID와_권한을_꺼낸다() {
        String token = jwtTokenProvider.createAccessToken(user(7L, UserRole.ADMIN, UserStatus.ACTIVE)).value();

        AuthUser authUser = jwtTokenProvider.parseAccessToken(token);

        assertThat(authUser).isEqualTo(new AuthUser(7L, UserRole.ADMIN));
    }

    @Test
    void 리프레시_토큰은_액세스_토큰으로_인정하지_않는다() {
        String refreshToken = jwtTokenProvider.createRefreshToken(activeUser(7L)).value();

        assertThatThrownBy(() -> jwtTokenProvider.parseAccessToken(refreshToken))
                .isInstanceOf(JwtException.class)
                .isNotInstanceOf(ExpiredJwtException.class);
    }

    @Test
    void 만료된_액세스_토큰은_ExpiredJwtException을_던진다() {
        String token = jwtTokenProvider.createAccessToken(activeUser(7L)).value();
        Clock afterExpiry = Clock.fixed(NOW.plus(Duration.ofMinutes(31)), ZONE);
        JwtTokenProvider later = new JwtTokenProvider(SIGNING_KEY, JWT_PROPERTIES, afterExpiry);

        assertThatThrownBy(() -> later.parseAccessToken(token)).isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    void 다른_키로_서명된_토큰은_거부한다() {
        JwtTokenProvider otherKeyProvider = new JwtTokenProvider(
                Keys.hmacShaKeyFor("another-secret-key-for-jwt-signing-32b".getBytes(StandardCharsets.UTF_8)),
                JWT_PROPERTIES, FIXED_CLOCK);
        String token = otherKeyProvider.createAccessToken(activeUser(7L)).value();

        assertThatThrownBy(() -> jwtTokenProvider.parseAccessToken(token)).isInstanceOf(JwtException.class);
    }

    @Test
    void 페이로드가_변조된_토큰은_거부한다() {
        String token = jwtTokenProvider.createAccessToken(activeUser(7L)).value();
        String forgedToken = jwtTokenProvider.createAccessToken(user(1L, UserRole.ADMIN, UserStatus.ACTIVE)).value();
        String[] parts = token.split("\\.");
        String[] forgedParts = forgedToken.split("\\.");
        // 다른 사용자의 페이로드 + 원래 서명
        String tampered = parts[0] + "." + forgedParts[1] + "." + parts[2];

        assertThatThrownBy(() -> jwtTokenProvider.parseAccessToken(tampered)).isInstanceOf(JwtException.class);
    }

    @Test
    void JWT_형식이_아닌_문자열은_거부한다() {
        assertThatThrownBy(() -> jwtTokenProvider.parseAccessToken("not-a-jwt")).isInstanceOf(JwtException.class);
    }

    @Test
    void role_Claim이_허용값이_아니면_거부한다() {
        String token = Jwts.builder()
                .subject("7")
                .claim("role", "SUPER_USER")
                .claim("type", "access")
                .issuedAt(Date.from(NOW))
                .expiration(Date.from(NOW.plusSeconds(60)))
                .signWith(SIGNING_KEY)
                .compact();

        assertThatThrownBy(() -> jwtTokenProvider.parseAccessToken(token)).isInstanceOf(JwtException.class);
    }

    private Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(SIGNING_KEY)
                .clock(() -> Date.from(NOW))
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
