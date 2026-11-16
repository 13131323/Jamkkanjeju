package com.jamkkanjeju.server.domain.agent.security;

import static org.assertj.core.api.Assertions.*;

import com.jamkkanjeju.server.domain.agent.config.AgentApiProperties;
import com.jamkkanjeju.server.domain.auth.exception.AuthErrorCode;
import com.jamkkanjeju.server.domain.auth.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

/** 고정 토큰의 인증 분기와 비밀 정보 비노출을 검증한다. */
class AgentTokenAuthenticationFilterTest {
    private static final String TOKEN = "private-agent-test-token";

    @AfterEach
    void clean() { SecurityContextHolder.clearContext(); }

    @Test
    void 정확한_토큰에만_전용_권한을_부여하고_원문은_보관하지_않는다() throws Exception {
        var request = new MockHttpServletRequest();
        request.addHeader(AgentTokenAuthenticationFilter.HEADER, TOKEN);
        run(TOKEN, request);
        var auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth.isAuthenticated()).isTrue();
        assertThat(auth.getAuthorities()).extracting("authority").containsExactly("AGENT_LOCATIONS_READ");
        assertThat(auth.getCredentials()).isNull();
        assertThat(auth.toString()).doesNotContain(TOKEN).doesNotContain("ROLE_ADMIN");
    }

    @Test
    void 헤더_누락은_인증_정보가_없다() throws Exception {
        var request = new MockHttpServletRequest();
        run(TOKEN, request);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(request.getAttribute(JwtAuthenticationFilter.AUTH_ERROR_ATTRIBUTE)).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", " ", "wrong", " private-agent-test-token", "Bearer private-agent-test-token"})
    void 잘못된_헤더는_거부한다(String value) throws Exception {
        var request = new MockHttpServletRequest();
        request.addHeader(AgentTokenAuthenticationFilter.HEADER, value);
        run(TOKEN, request);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(request.getAttribute(JwtAuthenticationFilter.AUTH_ERROR_ATTRIBUTE)).isEqualTo(AuthErrorCode.INVALID_TOKEN);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" "})
    void 서버_토큰이_설정되지_않으면_접근을_허용하지_않는다(String value) throws Exception {
        var request = new MockHttpServletRequest();
        request.addHeader(AgentTokenAuthenticationFilter.HEADER, TOKEN);
        run(value, request);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(request.getAttribute(JwtAuthenticationFilter.AUTH_ERROR_ATTRIBUTE)).isEqualTo(AuthErrorCode.INVALID_TOKEN);
    }

    @Test
    void 중복_헤더는_거부한다() throws Exception {
        var request = new MockHttpServletRequest();
        request.addHeader(AgentTokenAuthenticationFilter.HEADER, TOKEN);
        request.addHeader(AgentTokenAuthenticationFilter.HEADER, TOKEN);
        run(TOKEN, request);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void 설정_출력은_마스킹한다() {
        assertThat(new AgentApiProperties(TOKEN).toString()).contains("****").doesNotContain(TOKEN);
    }

    private void run(String expected, MockHttpServletRequest request) throws Exception {
        new AgentTokenAuthenticationFilter(new AgentApiProperties(expected)).doFilter(request,
                new MockHttpServletResponse(), (req, res) -> {});
    }
}
