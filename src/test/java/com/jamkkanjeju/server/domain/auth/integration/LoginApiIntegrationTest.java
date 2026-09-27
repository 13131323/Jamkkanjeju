package com.jamkkanjeju.server.domain.auth.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jamkkanjeju.server.domain.auth.entity.RefreshToken;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.entity.UserRole;
import com.jamkkanjeju.server.domain.auth.entity.UserStatus;
import com.jamkkanjeju.server.domain.auth.jwt.TokenHasher;
import com.jamkkanjeju.server.domain.auth.repository.RefreshTokenRepository;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.ResultActions;

/** POST /api/v2/auth/login 를 실제 HTTP 요청 흐름(필터 → 컨트롤러 → 서비스 → MySQL)으로 검증한다. */
class LoginApiIntegrationTest extends AuthIntegrationTestSupport {

    private static final String EMAIL = "login-it@example.com";

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private TokenHasher tokenHasher;

    @Autowired
    private EntityManager entityManager;

    @Test
    void 로그인에_성공하면_200과_명세의_응답_필드를_반환한다() throws Exception {
        User user = saveUser(EMAIL, UserRole.USER, UserStatus.ACTIVE);

        performLogin(loginBody(EMAIL, PASSWORD, "iPhone 15 / iOS 18"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(jsonPath("$.refreshToken").isString())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.accessTokenExpiresIn").value(1800))
                .andExpect(jsonPath("$.refreshTokenExpiresIn").value(1_209_600))
                .andExpect(jsonPath("$.user.id").value(user.getId()))
                .andExpect(jsonPath("$.user.nickname").value("몽글몽글파도"))
                .andExpect(jsonPath("$.user.role").value("USER"))
                .andExpect(jsonPath("$.user.onboardingCompleted").value(false));
    }

    @Test
    void 로그인하면_리프레시_토큰의_SHA_256_해시와_기기정보가_DB에_저장된다() throws Exception {
        User user = saveUser(EMAIL, UserRole.USER, UserStatus.ACTIVE);
        LocalDateTime before = LocalDateTime.now().withNano(0);

        String body = performLogin(loginBody(EMAIL, PASSWORD, "iPhone 15 / iOS 18"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String rawRefreshToken = JsonPath.read(body, "$.refreshToken");

        RefreshToken saved = refreshTokenRepository.findByTokenHash(tokenHasher.hash(rawRefreshToken)).orElseThrow();
        assertThat(saved.getUser().getId()).isEqualTo(user.getId());
        assertThat(saved.getTokenHash()).hasSize(64).isNotEqualTo(rawRefreshToken);
        assertThat(saved.getDeviceInfo()).isEqualTo("iPhone 15 / iOS 18");
        assertThat(saved.getRevokedAt()).isNull();
        assertThat(saved.getExpiresAt()).isBetween(before.plus(Duration.ofDays(14)),
                LocalDateTime.now().plus(Duration.ofDays(14)));
    }

    @Test
    void 이메일의_앞뒤_공백과_대문자를_정규화해서_조회한다() throws Exception {
        saveUser(EMAIL, UserRole.USER, UserStatus.ACTIVE);

        performLogin(loginBody("  Login-IT@Example.COM  ", PASSWORD, null))
                .andExpect(status().isOk());
    }

    @Test
    void 같은_사용자가_여러_번_로그인하면_각각_독립된_리프레시_토큰이_저장된다() throws Exception {
        User user = saveUser(EMAIL, UserRole.USER, UserStatus.ACTIVE);

        String first = JsonPath.read(login(EMAIL), "$.refreshToken");
        String second = JsonPath.read(login(EMAIL), "$.refreshToken");

        assertThat(first).isNotEqualTo(second);
        List<RefreshToken> tokens = refreshTokenRepository.findAll().stream()
                .filter(token -> token.getUser().getId().equals(user.getId()))
                .toList();
        assertThat(tokens).hasSize(2);
        assertThat(tokens).extracting(RefreshToken::getRevokedAt).containsOnlyNulls();
    }

    @Test
    void 온보딩_결과가_있는_사용자는_onboardingCompleted가_true다() throws Exception {
        OnboardingResult onboardingResult = OnboardingResult.builder()
                .userType("탐험가")
                .typeDescription("새로운 곳을 좋아하는 여행자")
                .hashtags(List.of("#바다", "#오름"))
                .profileImgUrl("https://example.com/profile.png")
                .build();
        entityManager.persist(onboardingResult);
        User user = saveUser(EMAIL, UserRole.USER, UserStatus.ACTIVE);
        ReflectionTestUtils.setField(user, "onboardingResult", onboardingResult);
        entityManager.flush();

        performLogin(loginBody(EMAIL, PASSWORD, null))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.onboardingCompleted").value(true));
    }

    @Test
    void ADMIN_사용자는_role이_ADMIN으로_응답된다() throws Exception {
        saveUser(EMAIL, UserRole.ADMIN, UserStatus.ACTIVE);

        performLogin(loginBody(EMAIL, PASSWORD, null))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("ADMIN"));
    }

    @Test
    void 비밀번호가_틀리면_401_INVALID_CREDENTIALS() throws Exception {
        saveUser(EMAIL, UserRole.USER, UserStatus.ACTIVE);

        performLogin(loginBody(EMAIL, "wrongpass123!", null))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.message").value("이메일 또는 비밀번호가 올바르지 않습니다."));
    }

    @Test
    void 가입되지_않은_이메일이면_비밀번호_불일치와_같은_401_INVALID_CREDENTIALS() throws Exception {
        performLogin(loginBody("nobody@example.com", PASSWORD, null))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.message").value("이메일 또는 비밀번호가 올바르지 않습니다."));
    }

    @Test
    void 정지된_사용자는_403_USER_SUSPENDED이고_토큰을_저장하지_않는다() throws Exception {
        saveUser(EMAIL, UserRole.USER, UserStatus.SUSPENDED);
        long before = refreshTokenRepository.count();

        performLogin(loginBody(EMAIL, PASSWORD, null))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("USER_SUSPENDED"))
                .andExpect(jsonPath("$.message").value("정지된 계정입니다."));

        assertThat(refreshTokenRepository.count()).isEqualTo(before);
    }

    @Test
    void 탈퇴한_사용자는_403_USER_WITHDRAWN() throws Exception {
        saveUser(EMAIL, UserRole.USER, UserStatus.WITHDRAWN);

        performLogin(loginBody(EMAIL, PASSWORD, null))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("USER_WITHDRAWN"))
                .andExpect(jsonPath("$.message").value("탈퇴한 계정입니다."));
    }

    @Test
    void 요청값_검증에_실패하면_400_INVALID_REQUEST() throws Exception {
        List<String> invalidBodies = List.of(
                loginBody("user example.com", PASSWORD, null),   // 이메일 형식 오류
                loginBody("user@example", PASSWORD, null),       // 도메인에 점 없음
                loginBody(EMAIL, "abc1!", null),                 // 비밀번호 8자 미만
                loginBody(EMAIL, "pass word1!", null),           // 비밀번호 공백
                loginBody(EMAIL, PASSWORD, "a".repeat(256)),     // deviceInfo 255자 초과
                "{\"password\": \"password123!\"}",              // 이메일 누락
                "{\"email\": \"user@example.com\"}",             // 비밀번호 누락
                "{",                                             // JSON 파싱 실패
                ""                                               // 빈 본문
        );

        for (String body : invalidBodies) {
            performLogin(body)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                    .andExpect(jsonPath("$.message").value("요청값이 올바르지 않습니다."));
        }
    }

    @Test
    void 로그인은_인증_없이_호출할_수_있고_잘못된_Authorization_헤더가_있어도_성공한다() throws Exception {
        saveUser(EMAIL, UserRole.USER, UserStatus.ACTIVE);

        mockMvc.perform(post(LOGIN_URL)
                        .header("Authorization", "Bearer expired-or-broken-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody(EMAIL, PASSWORD, null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value(startsWith("eyJ")));
    }

    @Test
    void Content_Type이_JSON이_아니면_415() throws Exception {
        mockMvc.perform(post(LOGIN_URL)
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("email=user@example.com"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA_TYPE"));
    }

    private ResultActions performLogin(String body) throws Exception {
        return mockMvc.perform(post(LOGIN_URL)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }
}
