package com.jamkkanjeju.server.domain.auth.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.FIXED_CLOCK;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.NOW;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.ZONE;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.user;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.domain.auth.dto.LoginRequest;
import com.jamkkanjeju.server.domain.auth.dto.LoginResponse;
import com.jamkkanjeju.server.domain.auth.entity.RefreshToken;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.entity.UserRole;
import com.jamkkanjeju.server.domain.auth.entity.UserStatus;
import com.jamkkanjeju.server.domain.auth.exception.AuthErrorCode;
import com.jamkkanjeju.server.domain.auth.jwt.IssuedToken;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.auth.jwt.TokenHasher;
import com.jamkkanjeju.server.domain.auth.repository.RefreshTokenRepository;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String EMAIL = "user@example.com";
    private static final String PASSWORD = "password123!";
    private static final IssuedToken ACCESS_TOKEN =
            new IssuedToken("access-token", NOW, NOW.plus(Duration.ofMinutes(30)));
    private static final IssuedToken REFRESH_TOKEN =
            new IssuedToken("refresh-token", NOW, NOW.plus(Duration.ofDays(14)));

    @Mock
    private UserRepository userRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtTokenProvider jwtTokenProvider;
    @Mock
    private TokenHasher tokenHasher;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, refreshTokenRepository, passwordEncoder,
                jwtTokenProvider, tokenHasher, FIXED_CLOCK);
    }

    @Test
    void 로그인에_성공하면_토큰과_사용자_정보를_반환한다() {
        User user = activeUser(15L);
        givenAuthenticated(user);
        givenTokensIssued(user);

        LoginResponse response = authService.login(new LoginRequest(EMAIL, PASSWORD, "iPhone 15 / iOS 18"));

        assertThat(response.accessToken()).isEqualTo("access-token");
        assertThat(response.refreshToken()).isEqualTo("refresh-token");
        assertThat(response.tokenType()).isEqualTo("Bearer");
        assertThat(response.accessTokenExpiresIn()).isEqualTo(1800);
        assertThat(response.refreshTokenExpiresIn()).isEqualTo(1_209_600);
        assertThat(response.user().id()).isEqualTo(15L);
        assertThat(response.user().nickname()).isEqualTo("몽글몽글파도");
        assertThat(response.user().role()).isEqualTo("USER");
        assertThat(response.user().onboardingCompleted()).isFalse();
    }

    @Test
    void 리프레시_토큰은_원문_대신_해시와_만료시각_기기정보로_저장한다() {
        User user = activeUser(15L);
        givenAuthenticated(user);
        givenTokensIssued(user);

        authService.login(new LoginRequest(EMAIL, PASSWORD, "iPhone 15 / iOS 18"));

        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(captor.capture());
        RefreshToken saved = captor.getValue();
        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getTokenHash()).isEqualTo("hashed-refresh-token");
        assertThat(saved.getExpiresAt()).isEqualTo(LocalDateTime.ofInstant(REFRESH_TOKEN.expiresAt(), ZONE));
        assertThat(saved.getDeviceInfo()).isEqualTo("iPhone 15 / iOS 18");
        assertThat(saved.getRevokedAt()).isNull();
    }

    @Test
    void deviceInfo를_보내지_않으면_null로_저장한다() {
        User user = activeUser(15L);
        givenAuthenticated(user);
        givenTokensIssued(user);

        authService.login(new LoginRequest(EMAIL, PASSWORD, null));

        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(captor.capture());
        assertThat(captor.getValue().getDeviceInfo()).isNull();
    }

    @Test
    void 온보딩_결과가_있으면_onboardingCompleted는_true다() {
        User user = activeUser(15L);
        ReflectionTestUtils.setField(user, "onboardingResult", mock(OnboardingResult.class));
        givenAuthenticated(user);
        givenTokensIssued(user);

        LoginResponse response = authService.login(new LoginRequest(EMAIL, PASSWORD, null));

        assertThat(response.user().onboardingCompleted()).isTrue();
    }

    @Test
    void ADMIN_사용자는_role이_ADMIN으로_응답된다() {
        User admin = user(1L, UserRole.ADMIN, UserStatus.ACTIVE);
        givenAuthenticated(admin);
        givenTokensIssued(admin);

        LoginResponse response = authService.login(new LoginRequest(EMAIL, PASSWORD, null));

        assertThat(response.user().role()).isEqualTo("ADMIN");
    }

    @Test
    void 가입되지_않은_이메일이면_INVALID_CREDENTIALS() {
        given(userRepository.findByEmail(EMAIL)).willReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest(EMAIL, PASSWORD, null)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(AuthErrorCode.INVALID_CREDENTIALS);

        verifyNoInteractions(jwtTokenProvider, refreshTokenRepository);
    }

    @Test
    void 비밀번호가_틀리면_가입되지_않은_이메일과_같은_INVALID_CREDENTIALS() {
        User user = activeUser(15L);
        given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(user));
        given(passwordEncoder.matches(PASSWORD, user.getPasswordHash())).willReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest(EMAIL, PASSWORD, null)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(AuthErrorCode.INVALID_CREDENTIALS);

        verifyNoInteractions(jwtTokenProvider, refreshTokenRepository);
    }

    @Test
    void 정지된_사용자는_USER_SUSPENDED() {
        givenAuthenticated(user(15L, UserRole.USER, UserStatus.SUSPENDED));

        assertThatThrownBy(() -> authService.login(new LoginRequest(EMAIL, PASSWORD, null)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(AuthErrorCode.USER_SUSPENDED);

        verifyNoInteractions(jwtTokenProvider, refreshTokenRepository);
    }

    @Test
    void 탈퇴한_사용자는_USER_WITHDRAWN() {
        givenAuthenticated(user(15L, UserRole.USER, UserStatus.WITHDRAWN));

        assertThatThrownBy(() -> authService.login(new LoginRequest(EMAIL, PASSWORD, null)))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(AuthErrorCode.USER_WITHDRAWN);

        verifyNoInteractions(jwtTokenProvider, refreshTokenRepository);
    }

    @Test
    void 비밀번호가_틀리면_계정_상태를_노출하지_않는다() {
        User suspended = user(15L, UserRole.USER, UserStatus.SUSPENDED);
        given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(suspended));
        given(passwordEncoder.matches(PASSWORD, suspended.getPasswordHash())).willReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest(EMAIL, PASSWORD, null)))
                .extracting("errorCode").isEqualTo(AuthErrorCode.INVALID_CREDENTIALS);
    }

    @Test
    void 리프레시_토큰_저장에_실패하면_예외가_전파되고_응답을_반환하지_않는다() {
        User user = activeUser(15L);
        givenAuthenticated(user);
        givenTokensIssued(user);
        given(refreshTokenRepository.save(any())).willThrow(new DataIntegrityViolationException("duplicate"));

        assertThatThrownBy(() -> authService.login(new LoginRequest(EMAIL, PASSWORD, null)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void 비즈니스_규칙의_처리_순서대로_호출한다() {
        User user = activeUser(15L);
        givenAuthenticated(user);
        givenTokensIssued(user);

        authService.login(new LoginRequest(EMAIL, PASSWORD, null));

        InOrder order = inOrder(userRepository, passwordEncoder, jwtTokenProvider, tokenHasher, refreshTokenRepository);
        order.verify(userRepository).findByEmail(EMAIL);
        order.verify(passwordEncoder).matches(PASSWORD, user.getPasswordHash());
        order.verify(jwtTokenProvider).createAccessToken(user);
        order.verify(jwtTokenProvider).createRefreshToken(user);
        order.verify(tokenHasher).hash("refresh-token");
        order.verify(refreshTokenRepository).save(any());
        verify(tokenHasher, never()).hash("access-token");
    }

    private void givenAuthenticated(User user) {
        given(userRepository.findByEmail(EMAIL)).willReturn(Optional.of(user));
        given(passwordEncoder.matches(PASSWORD, user.getPasswordHash())).willReturn(true);
    }

    private void givenTokensIssued(User user) {
        given(jwtTokenProvider.createAccessToken(user)).willReturn(ACCESS_TOKEN);
        given(jwtTokenProvider.createRefreshToken(user)).willReturn(REFRESH_TOKEN);
        given(tokenHasher.hash("refresh-token")).willReturn("hashed-refresh-token");
    }
}
