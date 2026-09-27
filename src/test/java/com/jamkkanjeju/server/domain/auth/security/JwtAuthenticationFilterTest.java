package com.jamkkanjeju.server.domain.auth.security;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.FIXED_CLOCK;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.JWT_PROPERTIES;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.NOW;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.SIGNING_KEY;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.ZONE;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.user;
import static org.assertj.core.api.Assertions.assertThat;

import com.jamkkanjeju.server.domain.auth.entity.UserRole;
import com.jamkkanjeju.server.domain.auth.entity.UserStatus;
import com.jamkkanjeju.server.domain.auth.exception.AuthErrorCode;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import java.time.Clock;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

class JwtAuthenticationFilterTest {

    private final JwtTokenProvider jwtTokenProvider = new JwtTokenProvider(SIGNING_KEY, JWT_PROPERTIES, FIXED_CLOCK);
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtTokenProvider);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void 유효한_액세스_토큰이면_SecurityContext에_AuthUser와_ROLE_권한을_넣는다() throws Exception {
        String token = jwtTokenProvider.createAccessToken(user(15L, UserRole.ADMIN, UserStatus.ACTIVE)).value();
        MockHttpServletRequest request = requestWithAuthorization("Bearer " + token);
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        assertThat(authentication).isNotNull();
        assertThat(authentication.isAuthenticated()).isTrue();
        assertThat(authentication.getPrincipal()).isEqualTo(new AuthUser(15L, UserRole.ADMIN));
        assertThat(authentication.getAuthorities()).extracting(GrantedAuthority::getAuthority)
                .containsExactly("ROLE_ADMIN");
        assertThat(request.getAttribute(JwtAuthenticationFilter.AUTH_ERROR_ATTRIBUTE)).isNull();
        assertThat(chain.getRequest()).isSameAs(request);
    }

    @Test
    void Authorization_헤더가_없으면_인증하지_않고_다음_필터로_넘긴다() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(request.getAttribute(JwtAuthenticationFilter.AUTH_ERROR_ATTRIBUTE)).isNull();
        assertThat(chain.getRequest()).isSameAs(request);
    }

    @Test
    void Bearer_방식이_아니면_INVALID_TOKEN을_남기고_다음_필터로_넘긴다() throws Exception {
        String token = jwtTokenProvider.createAccessToken(activeUser(15L)).value();

        assertAuthError("Basic " + token, AuthErrorCode.INVALID_TOKEN);
    }

    @Test
    void Bearer_뒤에_토큰이_없으면_INVALID_TOKEN() throws Exception {
        assertAuthError("Bearer ", AuthErrorCode.INVALID_TOKEN);
    }

    @Test
    void 형식이_잘못된_토큰이면_INVALID_TOKEN() throws Exception {
        assertAuthError("Bearer not-a-jwt", AuthErrorCode.INVALID_TOKEN);
    }

    @Test
    void 리프레시_토큰이면_INVALID_TOKEN() throws Exception {
        String refreshToken = jwtTokenProvider.createRefreshToken(activeUser(15L)).value();

        assertAuthError("Bearer " + refreshToken, AuthErrorCode.INVALID_TOKEN);
    }

    @Test
    void 만료된_토큰이면_EXPIRED_TOKEN() throws Exception {
        Clock past = Clock.fixed(NOW.minus(Duration.ofHours(1)), ZONE);
        String expired = new JwtTokenProvider(SIGNING_KEY, JWT_PROPERTIES, past).createAccessToken(activeUser(15L)).value();

        assertAuthError("Bearer " + expired, AuthErrorCode.EXPIRED_TOKEN);
    }

    private void assertAuthError(String authorization, AuthErrorCode expected) throws Exception {
        MockHttpServletRequest request = requestWithAuthorization(authorization);
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, new MockHttpServletResponse(), chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(request.getAttribute(JwtAuthenticationFilter.AUTH_ERROR_ATTRIBUTE)).isEqualTo(expected);
        assertThat(chain.getRequest()).as("오류가 있어도 필터 체인은 계속 진행된다").isSameAs(request);
    }

    private MockHttpServletRequest requestWithAuthorization(String value) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", value);
        return request;
    }
}
