package com.jamkkanjeju.server.domain.auth.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.FIXED_CLOCK;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.domain.auth.dto.LogoutRequest;
import com.jamkkanjeju.server.domain.auth.entity.RefreshToken;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.auth.jwt.TokenHasher;
import com.jamkkanjeju.server.domain.auth.repository.RefreshTokenRepository;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;

/** 로그아웃의 정확한 해시 조회·삭제와 실패 전파를 격리하여 검증한다. */
@ExtendWith(MockitoExtension.class)
class LogoutServiceTest {
    @Mock UserRepository users;
    @Mock RefreshTokenRepository records;
    @Mock PasswordEncoder passwords;
    @Mock JwtTokenProvider tokens;
    private final TokenHasher hasher = new TokenHasher();
    private AuthService service;
    private final LogoutRequest request = new LogoutRequest(" original-token ");

    @BeforeEach
    void prepare() {
        service = new AuthService(users, records, passwords, tokens, hasher, FIXED_CLOCK);
    }

    @Test
    void 원문_해시로_잠금_조회하고_해당_기록만_삭제한다() {
        RefreshToken record = mock(RefreshToken.class);
        when(records.findByTokenHashForUpdate(hasher.hash(request.refreshToken()))).thenReturn(Optional.of(record));
        service.logout(request);
        var order = inOrder(records);
        order.verify(records).findByTokenHashForUpdate(hasher.hash(" original-token "));
        order.verify(records).delete(record);
        verifyNoMoreInteractions(records);
        verifyNoInteractions(users, passwords, tokens, record);
    }

    @Test
    void 기록이_없으면_삭제나_발급_없이_정상_완료한다() {
        when(records.findByTokenHashForUpdate(hasher.hash(request.refreshToken()))).thenReturn(Optional.empty());
        assertThatCode(() -> service.logout(request)).doesNotThrowAnyException();
        verify(records).findByTokenHashForUpdate(hasher.hash(request.refreshToken()));
        verifyNoMoreInteractions(records);
        verifyNoInteractions(users, passwords, tokens);
    }

    @Test
    void 조회_실패를_성공으로_삼키지_않는다() {
        var failure = new DataIntegrityViolationException("forced-lookup-failure");
        when(records.findByTokenHashForUpdate(hasher.hash(request.refreshToken()))).thenThrow(failure);
        assertThatThrownBy(() -> service.logout(request)).isSameAs(failure);
        verify(records, never()).delete(any());
        verifyNoInteractions(users, passwords, tokens);
    }

    @Test
    void 삭제_실패를_성공으로_삼키지_않는다() {
        RefreshToken record = mock(RefreshToken.class);
        when(records.findByTokenHashForUpdate(hasher.hash(request.refreshToken()))).thenReturn(Optional.of(record));
        var failure = new DataIntegrityViolationException("forced-delete-failure");
        doThrow(failure).when(records).delete(record);
        assertThatThrownBy(() -> service.logout(request)).isSameAs(failure);
        verifyNoInteractions(users, passwords, tokens);
    }
}
