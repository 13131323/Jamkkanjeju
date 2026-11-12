package com.jamkkanjeju.server.domain.auth.integration;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.NOW;
import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.ZONE;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.domain.auth.config.JwtProperties;
import com.jamkkanjeju.server.domain.auth.entity.*;
import com.jamkkanjeju.server.domain.auth.jwt.*;
import com.jamkkanjeju.server.domain.auth.repository.*;
import com.jamkkanjeju.server.domain.auth.security.AuthUser;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.support.*;
import org.springframework.web.bind.annotation.*;

/** 로그아웃 HTTP 계약과 실제 MySQL 삭제·격리·잠금·롤백을 검증한다. */
@SpringBootTest(properties = {
        "app.blob-storage.container=logout-test",
        "spring.datasource.hikari.minimum-idle=0",
        "logging.level.org.hibernate.SQL=warn",
        "logging.level.org.hibernate.orm.jdbc.bind=off",
        "logging.level.com.jamkkanjeju.server.common.exception.GlobalExceptionHandler=debug"
})
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class LogoutApiIntegrationTest extends MySqlIntegrationTestSupport {
    private static final String URL = "/api/v2/auth/logout";
    private static final String PROBE = "/api/v2/test/logout-user";
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired TransactionTemplate transactions;
    @Autowired UserRepository users;
    @Autowired JwtTokenProvider tokens;
    @Autowired TokenHasher hasher;
    @Autowired SecretKey signingKey;
    @Autowired JwtProperties jwtProperties;
    @MockitoBean Clock clock;
    @MockitoSpyBean RefreshTokenRepository records;
    private User user;
    private User other;
    private String original;

    @BeforeEach
    void prepare() {
        when(clock.instant()).thenReturn(NOW);
        when(clock.getZone()).thenReturn(ZONE);
        transactions.execute(status -> {
            user = users.saveAndFlush(User.builder().email("logout-it@example.com").passwordHash("unused")
                    .nickname("로그아웃 사용자").role(UserRole.USER).status(UserStatus.ACTIVE).build());
            other = users.saveAndFlush(User.builder().email("logout-other-it@example.com").passwordHash("unused")
                    .nickname("다른 사용자").role(UserRole.USER).status(UserStatus.ACTIVE).build());
            return null;
        });
        original = issue(user, "original-device");
    }

    @AfterEach
    void clean() {
        for (User target : Arrays.asList(user, other)) {
            if (target != null && target.getId() != null) {
                jdbc.update("delete from refresh_token where user_id=?", target.getId());
                jdbc.update("delete from user where id=?", target.getId());
            }
        }
    }

    @Test
    void 인증_없이_204와_빈_본문을_반환하고_해당_기록만_물리_삭제한다() throws Exception {
        String device = issue(user, "other-device");
        String foreign = issue(other, "foreign-device");
        logout(original).andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(exists(original)).isFalse();
        assertThat(exists(device)).isTrue();
        assertThat(exists(foreign)).isTrue();
        assertThat(count(user)).isEqualTo(1);
        assertThat(count(other)).isEqualTo(1);
        assertThat(users.findById(user.getId())).isPresent();
    }

    @ParameterizedTest
    @ValueSource(strings = {"broken", "expired", "other-user"})
    void Authorization과_관계없이_Body의_토큰만_삭제한다(String kind) throws Exception {
        String foreign = issue(other, "other-device");
        String access = switch (kind) {
            case "expired" -> new JwtTokenProvider(signingKey, jwtProperties, Clock.fixed(NOW.minusSeconds(3600), ZONE)).createAccessToken(other).value();
            case "other-user" -> tokens.createAccessToken(other).value();
            default -> "broken-token";
        };
        mvc.perform(post(URL).header("Authorization", "Bearer " + access).contentType(MediaType.APPLICATION_JSON).content(body(original)))
                .andExpect(status().isNoContent());
        assertThat(exists(original)).isFalse();
        assertThat(exists(foreign)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"jwt-expired", "db-expired", "revoked"})
    void 만료되거나_폐기된_토큰도_삭제한다(String state) throws Exception {
        switch (state) {
            case "jwt-expired" -> when(clock.instant()).thenReturn(NOW.plus(Duration.ofDays(15)));
            case "db-expired" -> jdbc.update("update refresh_token set expires_at=? where token_hash=?", LocalDateTime.ofInstant(NOW, ZONE), hasher.hash(original));
            default -> jdbc.update("update refresh_token set revoked_at=? where token_hash=?", LocalDateTime.ofInstant(NOW, ZONE), hasher.hash(original));
        }
        logout(original).andExpect(status().isNoContent());
        assertThat(exists(original)).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"SUSPENDED", "WITHDRAWN"})
    void 정지나_탈퇴_사용자도_로그아웃한다(String state) throws Exception {
        jdbc.update("update user set status=? where id=?", state, user.getId());
        logout(original).andExpect(status().isNoContent());
        assertThat(exists(original)).isFalse();
        assertThat(jdbc.queryForObject("select status from user where id=?", String.class, user.getId())).isEqualTo(state);
    }

    @Test
    void 등록되지_않은_문자열은_204이며_기존_기록을_유지한다() throws Exception {
        logout("not-a-registered-jwt").andExpect(status().isNoContent());
        assertThat(exists(original)).isTrue();
        assertThat(count(user)).isEqualTo(1);
    }

    @Test
    void 앞뒤_공백을_제거하여_다른_기록을_삭제하지_않는다() throws Exception {
        logout(" " + original + " ").andExpect(status().isNoContent());
        assertThat(exists(original)).isTrue();
    }

    @Test
    void 같은_토큰으로_반복_로그아웃해도_204다() throws Exception {
        logout(original).andExpect(status().isNoContent());
        logout(original).andExpect(status().isNoContent()).andExpect(content().string(""));
        assertThat(count(user)).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"refreshToken\":null}", "{\"refreshToken\":\"\"}", "{\"refreshToken\":\"   \"}",
            "{\"refreshToken\":123}", "{\"refreshToken\":true}", "{\"refreshToken\":[]}", "{\"refreshToken\":{}}", "{", ""})
    void 잘못된_본문은_400이며_토큰을_유지한다(String invalid) throws Exception {
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(invalid))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.message").value("요청값이 올바르지 않습니다."));
        assertThat(exists(original)).isTrue();
        assertThat(count(user)).isEqualTo(1);
    }

    @Test
    void 로그아웃_이후_재발급은_실패하지만_기존_액세스_토큰은_유효하다() throws Exception {
        String access = tokens.createAccessToken(user).value();
        logout(original).andExpect(status().isNoContent());
        refresh(original).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
        mvc.perform(get(PROBE).header("Authorization", "Bearer " + access))
                .andExpect(status().isOk()).andExpect(jsonPath("$.userId").value(user.getId()));
        assertThat(count(user)).isZero();
    }

    @Test
    void 재발급_이후에는_최신_토큰으로_로그아웃한다() throws Exception {
        String next = JsonPath.read(refresh(original).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.refreshToken");
        logout(original).andExpect(status().isNoContent());
        assertThat(exists(next)).isTrue();
        logout(next).andExpect(status().isNoContent());
        refresh(next).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
        assertThat(count(user)).isZero();
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void 삭제나_커밋_실패는_500이며_실제_삭제를_롤백한다(boolean failAtCommit) throws Exception {
        AtomicBoolean flushed = new AtomicBoolean();
        AtomicBoolean commitReached = new AtomicBoolean();
        doAnswer(invocation -> {
            em.remove(invocation.getArgument(0, RefreshToken.class));
            em.flush();
            assertThat(exists(original)).isFalse();
            flushed.set(true);
            if (!failAtCommit) throw new DataIntegrityViolationException("forced-logout-delete-failure");
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void beforeCommit(boolean readOnly) {
                    commitReached.set(true);
                    throw new DataIntegrityViolationException("forced-logout-commit-failure");
                }
            });
            return null;
        }).when(records).delete(any(RefreshToken.class));
        logout(original).andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("INTERNAL_SERVER_ERROR"))
                .andExpect(jsonPath("$.message").value("서버 내부 오류가 발생했습니다."));
        assertThat(flushed).isTrue();
        assertThat(commitReached.get()).isEqualTo(failAtCommit);
        assertThat(exists(original)).isTrue();
        assertThat(count(user)).isEqualTo(1);
    }

    @Test
    void 동시_로그아웃은_모두_성공하고_기록을_남기지_않는다() throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Callable<Integer> request = () -> {
                assertThat(start.await(10, TimeUnit.SECONDS)).isTrue();
                return logout(original).andReturn().getResponse().getStatus();
            };
            Future<Integer> first = pool.submit(request);
            Future<Integer> second = pool.submit(request);
            start.countDown();
            assertThat(first.get(15, TimeUnit.SECONDS)).isEqualTo(204);
            assertThat(second.get(15, TimeUnit.SECONDS)).isEqualTo(204);
        }
        assertThat(count(user)).isZero();
    }

    @Test
    void 로그아웃이_먼저_잠금을_잡으면_동시_재발급은_실패한다() throws Exception {
        CountDownLatch deleted = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        doAnswer(invocation -> {
            em.remove(invocation.getArgument(0, RefreshToken.class));
            em.flush();
            deleted.countDown();
            assertThat(release.await(10, TimeUnit.SECONDS)).isTrue();
            return null;
        }).when(records).delete(any(RefreshToken.class));
        try (ExecutorService pool = Executors.newFixedThreadPool(2)) {
            Future<Integer> logout = pool.submit(() -> logout(original).andReturn().getResponse().getStatus());
            try {
                assertThat(deleted.await(10, TimeUnit.SECONDS)).isTrue();
                Future<Integer> refresh = pool.submit(() -> refresh(original).andReturn().getResponse().getStatus());
                release.countDown();
                assertThat(logout.get(15, TimeUnit.SECONDS)).isEqualTo(204);
                assertThat(refresh.get(15, TimeUnit.SECONDS)).isEqualTo(401);
            } finally {
                release.countDown();
            }
        }
        assertThat(count(user)).isZero();
    }

    @Test
    void JSON_오류_로그에_토큰을_남기지_않는다(CapturedOutput output) throws Exception {
        String secret = "private-logout-log-sentinel";
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content("{\"refreshToken\":{\"value\":\"" + secret + "\"}}"))
                .andExpect(status().isBadRequest());
        assertThat(output.getAll()).contains("Invalid logout request").doesNotContain(secret);
        assertThat(exists(original)).isTrue();
    }

    private String issue(User owner, String device) {
        IssuedToken issued = tokens.createRefreshToken(owner);
        transactions.execute(status -> records.saveAndFlush(RefreshToken.builder().user(owner)
                .tokenHash(hasher.hash(issued.value())).expiresAt(LocalDateTime.ofInstant(issued.expiresAt(), ZONE)).deviceInfo(device).build()));
        return issued.value();
    }

    private String body(String raw) { return "{\"refreshToken\":\"" + raw + "\"}"; }
    private ResultActions logout(String raw) throws Exception { return mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body(raw))); }
    private ResultActions refresh(String raw) throws Exception { return mvc.perform(post("/api/v2/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(body(raw))); }
    private boolean exists(String raw) { return jdbc.queryForObject("select count(*) from refresh_token where token_hash=?", Integer.class, hasher.hash(raw)) > 0; }
    private int count(User owner) { return jdbc.queryForObject("select count(*) from refresh_token where user_id=?", Integer.class, owner.getId()); }

    @TestConfiguration
    static class ProbeConfig {
        @Bean ProbeController logoutProbeController() { return new ProbeController(); }
    }

    @RestController
    static class ProbeController {
        @GetMapping(PROBE)
        Map<String, Object> me(@AuthenticationPrincipal AuthUser auth) { return Map.of("userId", auth.userId()); }
    }
}
