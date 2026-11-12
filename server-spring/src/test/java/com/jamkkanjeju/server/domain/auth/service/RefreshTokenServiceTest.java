package com.jamkkanjeju.server.domain.auth.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.common.exception.ErrorCode;
import com.jamkkanjeju.server.domain.auth.dto.RefreshTokenRequest;
import com.jamkkanjeju.server.domain.auth.entity.RefreshToken;
import com.jamkkanjeju.server.domain.auth.entity.UserStatus;
import com.jamkkanjeju.server.domain.auth.entity.UserRole;
import com.jamkkanjeju.server.domain.auth.exception.AuthErrorCode;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.auth.jwt.TokenHasher;
import com.jamkkanjeju.server.domain.auth.repository.RefreshTokenRepository;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

/** 검증 실패 분기를 격리하고 발급·토큰 상태가 변경되지 않는지 확인한다. */
@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {
    private static final String RAW = "raw-refresh-token";
    private static final LocalDateTime CURRENT = LocalDateTime.ofInstant(NOW, ZONE);
    @Mock UserRepository users;
    @Mock RefreshTokenRepository records;
    @Mock PasswordEncoder passwords;
    @Mock JwtTokenProvider jwt;
    private final TokenHasher hasher = new TokenHasher();
    private AuthService service;

    @BeforeEach
    void prepare() { service = new AuthService(users, records, passwords, jwt, hasher, FIXED_CLOCK); }

    @Test
    void JWT_만료는_EXPIRED_TOKEN으로_변환한다() {
        when(jwt.parseRefreshToken(RAW)).thenThrow(new ExpiredJwtException(null, null, "expired"));
        fails(AuthErrorCode.EXPIRED_TOKEN);
        verifyNoInteractions(records, users);
    }

    @Test
    void JWT_검증_실패는_INVALID_TOKEN으로_변환한다() {
        when(jwt.parseRefreshToken(RAW)).thenThrow(new JwtException("invalid"));
        fails(AuthErrorCode.INVALID_TOKEN);
        verifyNoInteractions(records, users);
    }

    @Test
    void 저장되지_않은_토큰을_거부한다() {
        when(jwt.parseRefreshToken(RAW)).thenReturn(7L);
        when(records.findByTokenHashForUpdate(hasher.hash(RAW))).thenReturn(Optional.empty());
        fails(AuthErrorCode.INVALID_TOKEN);
        verifyNoInteractions(users);
    }

    @Test
    void 토큰과_저장_기록의_소유자가_다르면_거부한다() {
        RefreshToken previous = previous(8L, CURRENT.plusSeconds(60), null);
        stored(previous);
        fails(AuthErrorCode.INVALID_TOKEN);
        assertThat(previous.getRevokedAt()).isNull();
        verifyNoInteractions(users);
    }

    @Test
    void 이미_폐기된_토큰을_거부한다() {
        RefreshToken previous = previous(7L, CURRENT.plusSeconds(60), CURRENT.minusSeconds(1));
        stored(previous);
        fails(AuthErrorCode.INVALID_TOKEN);
        assertThat(previous.getRevokedAt()).isEqualTo(CURRENT.minusSeconds(1));
    }

    @ParameterizedTest
    @ValueSource(ints = {-1, 0})
    void DB_만료_시각이_현재_이하면_거부한다(int seconds) {
        RefreshToken previous = previous(7L, CURRENT.plusSeconds(seconds), null);
        stored(previous);
        fails(AuthErrorCode.EXPIRED_TOKEN);
        assertThat(previous.getRevokedAt()).isNull();
        verifyNoInteractions(users);
    }

    @Test
    void 사용자가_없으면_UNAUTHORIZED다() {
        RefreshToken previous = previous(7L, CURRENT.plusSeconds(60), null);
        stored(previous);
        when(users.findById(7L)).thenReturn(Optional.empty());
        fails(CommonErrorCode.UNAUTHORIZED);
        assertThat(previous.getRevokedAt()).isNull();
    }

    @ParameterizedTest
    @CsvSource({"SUSPENDED,USER_SUSPENDED", "WITHDRAWN,USER_WITHDRAWN"})
    void 활성_사용자가_아니면_기존_토큰을_유지한다(UserStatus status, AuthErrorCode error) {
        RefreshToken previous = previous(7L, CURRENT.plusSeconds(60), null);
        stored(previous);
        when(users.findById(7L)).thenReturn(Optional.of(user(7L, UserRole.USER, status)));
        fails(error);
        assertThat(previous.getRevokedAt()).isNull();
    }

    private void stored(RefreshToken record) {
        when(jwt.parseRefreshToken(RAW)).thenReturn(7L);
        when(records.findByTokenHashForUpdate(hasher.hash(RAW))).thenReturn(Optional.of(record));
    }
    private RefreshToken previous(Long userId, LocalDateTime expires, LocalDateTime revoked) {
        return RefreshToken.builder().user(activeUser(userId)).tokenHash(hasher.hash(RAW))
                .expiresAt(expires).revokedAt(revoked).deviceInfo("test-device").build();
    }
    private void fails(ErrorCode code) {
        assertThatThrownBy(() -> service.refresh(new RefreshTokenRequest(RAW))).extracting("errorCode").isEqualTo(code);
        verify(jwt, never()).createAccessToken(any());
        verify(jwt, never()).createRefreshToken(any());
        verify(records, never()).save(any());
    }
}
