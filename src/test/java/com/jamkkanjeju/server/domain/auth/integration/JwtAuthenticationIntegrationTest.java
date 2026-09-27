package com.jamkkanjeju.server.domain.auth.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jamkkanjeju.server.domain.auth.config.JwtProperties;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.entity.UserRole;
import com.jamkkanjeju.server.domain.auth.entity.UserStatus;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jayway.jsonpath.JsonPath;
import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * JWT 인증 필터 + 401/403 JSON 응답을 검증한다.
 * 아직 인증이 필요한 실제 API가 없어서 테스트 전용 컨트롤러(/api/v2/test/**)를 등록해 호출한다.
 */
class JwtAuthenticationIntegrationTest extends AuthIntegrationTestSupport {

    private static final String ME_URL = "/api/v2/test/me";
    private static final String ADMIN_URL = "/api/v2/test/admin";

    @Autowired
    private SecretKey jwtSigningKey;

    @Autowired
    private JwtProperties jwtProperties;

    @Test
    void 로그인으로_받은_액세스_토큰으로_인증이_필요한_API를_호출할_수_있다() throws Exception {
        User user = saveUser("jwt-it@example.com", UserRole.USER, UserStatus.ACTIVE);
        String accessToken = loginAndGetAccessToken("jwt-it@example.com");

        callWithToken(ME_URL, "Bearer " + accessToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(user.getId()))
                .andExpect(jsonPath("$.role").value("USER"));
    }

    @Test
    void 토큰_없이_호출하면_401_UNAUTHORIZED() throws Exception {
        mockMvc.perform(get(ME_URL))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("인증이 필요합니다."));
    }

    @Test
    void 존재하지_않는_경로도_인증이_없으면_401이다() throws Exception {
        mockMvc.perform(get("/api/v2/not-exists"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void 리프레시_토큰으로_호출하면_401_INVALID_TOKEN() throws Exception {
        saveUser("jwt-it@example.com", UserRole.USER, UserStatus.ACTIVE);
        String refreshToken = JsonPath.read(login("jwt-it@example.com"), "$.refreshToken");

        callWithToken(ME_URL, "Bearer " + refreshToken)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"))
                .andExpect(jsonPath("$.message").value("유효하지 않은 토큰입니다."));
    }

    @Test
    void 변조된_토큰이면_401_INVALID_TOKEN() throws Exception {
        saveUser("jwt-it@example.com", UserRole.USER, UserStatus.ACTIVE);
        String accessToken = loginAndGetAccessToken("jwt-it@example.com");

        callWithToken(ME_URL, "Bearer " + accessToken + "a")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    }

    @Test
    void Bearer_방식이_아니면_401_INVALID_TOKEN() throws Exception {
        saveUser("jwt-it@example.com", UserRole.USER, UserStatus.ACTIVE);
        String accessToken = loginAndGetAccessToken("jwt-it@example.com");

        callWithToken(ME_URL, "Token " + accessToken)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    }

    @Test
    void 만료된_토큰이면_401_EXPIRED_TOKEN() throws Exception {
        User user = saveUser("jwt-it@example.com", UserRole.USER, UserStatus.ACTIVE);
        Clock anHourAgo = Clock.offset(Clock.systemDefaultZone(), Duration.ofHours(-1));
        String expired = new JwtTokenProvider(jwtSigningKey, jwtProperties, anHourAgo)
                .createAccessToken(user).value();

        callWithToken(ME_URL, "Bearer " + expired)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("EXPIRED_TOKEN"))
                .andExpect(jsonPath("$.message").value("만료된 토큰입니다."));
    }

    @Test
    void USER가_ADMIN_전용_API를_호출하면_403_FORBIDDEN() throws Exception {
        saveUser("jwt-it@example.com", UserRole.USER, UserStatus.ACTIVE);
        String accessToken = loginAndGetAccessToken("jwt-it@example.com");

        callWithToken(ADMIN_URL, "Bearer " + accessToken)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("접근 권한이 없습니다."));
    }

    @Test
    void ADMIN은_ADMIN_전용_API를_호출할_수_있다() throws Exception {
        saveUser("jwt-admin-it@example.com", UserRole.ADMIN, UserStatus.ACTIVE);
        String accessToken = loginAndGetAccessToken("jwt-admin-it@example.com");

        callWithToken(ADMIN_URL, "Bearer " + accessToken)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    private ResultActions callWithToken(String url, String authorization) throws Exception {
        return mockMvc.perform(get(url).header("Authorization", authorization));
    }

    @TestConfiguration
    static class ProbeControllerConfig {

        @Bean
        ProbeController probeController() {
            return new ProbeController();
        }
    }

    @RestController
    public static class ProbeController {

        @GetMapping(ME_URL)
        public Map<String, Object> me(@AuthenticationPrincipal AuthUser authUser) {
            return Map.of("userId", authUser.userId(), "role", authUser.role().name());
        }

        @PreAuthorize("hasRole('ADMIN')")
        @GetMapping(ADMIN_URL)
        public Map<String, Object> admin(@AuthenticationPrincipal AuthUser authUser) {
            return Map.of("userId", authUser.userId(), "role", authUser.role().name());
        }
    }
}
