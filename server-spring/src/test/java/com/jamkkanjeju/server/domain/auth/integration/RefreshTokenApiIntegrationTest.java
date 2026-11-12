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

/** 실제 DB 커밋·잠금·롤백과 HTTP 계약을 검증한다. 개발 DB 대신 실행별 임시 DB만 사용한다. */
@SpringBootTest(properties = {
        "spring.datasource.hikari.minimum-idle=0",
        "logging.level.org.hibernate.SQL=warn",
        "logging.level.org.hibernate.orm.jdbc.bind=off",
        "logging.level.com.jamkkanjeju.server.common.exception.GlobalExceptionHandler=debug"
})
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class RefreshTokenApiIntegrationTest extends MySqlIntegrationTestSupport {
    private static final String URL = "/api/v2/auth/refresh";
    private static final String PROBE = "/api/v2/test/refresh-user";
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
            user = users.saveAndFlush(User.builder().email("refresh-it@example.com").passwordHash("unused")
                    .nickname("재발급 사용자").role(UserRole.USER).status(UserStatus.ACTIVE).build());
            other = users.saveAndFlush(User.builder().email("refresh-other-it@example.com").passwordHash("unused")
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
    void 인증_없이_재발급하고_현재_사용자와_회전한_토큰을_반환한다() throws Exception {
        jdbc.update("update user set role='ADMIN', nickname='새 닉네임', onboarding_result_id=1 where id=?", user.getId());
        String body = refresh(original).andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.accessTokenExpiresIn").value(1800))
                .andExpect(jsonPath("$.refreshTokenExpiresIn").value(1209600))
                .andExpect(jsonPath("$.user.id").value(user.getId()))
                .andExpect(jsonPath("$.user.nickname").value("새 닉네임"))
                .andExpect(jsonPath("$.user.role").value("ADMIN"))
                .andExpect(jsonPath("$.user.onboardingCompleted").value(true))
                .andReturn().getResponse().getContentAsString();
        String next = JsonPath.read(body, "$.refreshToken");
        String access = JsonPath.read(body, "$.accessToken");
        assertThat(next).isNotEqualTo(original);
        assertThat(tokens.parseAccessToken(access).role()).isEqualTo(UserRole.ADMIN);
        assertThat(tokens.parseRefreshToken(next)).isEqualTo(user.getId());
        assertThat(JsonPath.<Map<String, Object>>read(body, "$")).hasSize(6);
        assertThat(count(user)).isEqualTo(2);
        assertThat(revoked(original)).isEqualTo(LocalDateTime.ofInstant(NOW, ZONE));
        RefreshToken saved = records.findByTokenHash(hasher.hash(next)).orElseThrow();
        assertThat(saved.getTokenHash()).hasSize(64).isNotEqualTo(next);
        assertThat(saved.getDeviceInfo()).isEqualTo("original-device");
        assertThat(saved.getRevokedAt()).isNull();
        assertThat(saved.getExpiresAt()).isEqualTo(LocalDateTime.ofInstant(NOW.plus(Duration.ofDays(14)), ZONE));
        mvc.perform(get(PROBE).header("Authorization", "Bearer " + access))
                .andExpect(status().isOk()).andExpect(jsonPath("$.userId").value(user.getId()))
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    @Test
    void 새_토큰으로_연속_재발급하고_사용한_토큰은_재사용하지_못한다() throws Exception {
        String first = JsonPath.read(refresh(original).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.refreshToken");
        String second = JsonPath.read(refresh(first).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.refreshToken");
        assertThat(second).isNotEqualTo(first).isNotEqualTo(original);
        refresh(original).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
        refresh(first).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
        assertThat(count(user)).isEqualTo(3);
        assertThat(revoked(second)).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"broken", "expired", "other-user"})
    void Authorization과_관계없이_Body의_사용자로_재발급한다(String headerKind) throws Exception {
        String access = switch (headerKind) {
            case "expired" -> new JwtTokenProvider(signingKey, jwtProperties, Clock.fixed(NOW.minusSeconds(3600), ZONE)).createAccessToken(other).value();
            case "other-user" -> tokens.createAccessToken(other).value();
            default -> "broken-token";
        };
        mvc.perform(post(URL).header("Authorization", "Bearer " + access).contentType(MediaType.APPLICATION_JSON).content(body(original)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.id").value(user.getId()));
        assertThat(count(other)).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"refreshToken\":null}", "{\"refreshToken\":\"\"}", "{\"refreshToken\":\"   \"}",
            "{\"refreshToken\":123}", "{\"refreshToken\":true}", "{\"refreshToken\":[]}", "{\"refreshToken\":{}}", "{", ""})
    void 잘못된_본문은_400이며_기존_토큰을_유지한다(String invalid) throws Exception {
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(invalid))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.message").value("요청값이 올바르지 않습니다."));
        unchanged();
    }

    @Test
    void 서버에_등록하지_않은_토큰을_거부한다() throws Exception {
        invalid(tokens.createRefreshToken(user).value(), "INVALID_TOKEN"); unchanged();
    }

    @Test
    void 액세스_토큰을_Body에_보내면_거부한다() throws Exception {
        invalid(tokens.createAccessToken(user).value(), "INVALID_TOKEN"); unchanged();
    }

    @Test
    void JWT_만료_정각에는_401_EXPIRED_TOKEN이다() throws Exception {
        when(clock.instant()).thenReturn(NOW.plus(Duration.ofDays(14)));
        invalid(original, "EXPIRED_TOKEN"); unchanged();
    }

    @Test
    void DB_만료_정각에도_401_EXPIRED_TOKEN이다() throws Exception {
        jdbc.update("update refresh_token set expires_at=? where token_hash=?", LocalDateTime.ofInstant(NOW, ZONE), hasher.hash(original));
        invalid(original, "EXPIRED_TOKEN"); unchanged();
    }

    @Test
    void 토큰_저장_기록의_소유자가_다르면_거부한다() throws Exception {
        jdbc.update("update refresh_token set user_id=? where token_hash=?", other.getId(), hasher.hash(original));
        invalid(original, "INVALID_TOKEN");
        assertThat(revoked(original)).isNull();
        assertThat(count(user)).isZero(); assertThat(count(other)).isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"SUSPENDED", "WITHDRAWN"})
    void 정지_탈퇴_계정은_403이며_토큰을_폐기하지_않는다(String state) throws Exception {
        jdbc.update("update user set status=? where id=?", state, user.getId());
        refresh(original).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("USER_" + state));
        unchanged();
    }

    @Test
    void 다른_기기와_다른_사용자의_토큰은_유지한다() throws Exception {
        String device2 = issue(user, "another-device");
        String otherToken = issue(other, null);
        refresh(original).andExpect(status().isOk());
        assertThat(revoked(original)).isNotNull();
        assertThat(revoked(device2)).isNull(); assertThat(revoked(otherToken)).isNull();
        assertThat(count(user)).isEqualTo(3); assertThat(count(other)).isEqualTo(1);
    }

    @Test
    void 같은_토큰의_동시_요청은_하나만_성공한다() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            Callable<MvcResult> action = () -> { start.await(); return refresh(original).andReturn(); };
            Future<MvcResult> first = executor.submit(action);
            Future<MvcResult> second = executor.submit(action);
            start.countDown();
            List<MvcResult> results = List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS));
            assertThat(results).extracting(r -> r.getResponse().getStatus()).containsExactlyInAnyOrder(200, 401);
            for (MvcResult result : results) {
                if (result.getResponse().getStatus() == 401) assertThat(JsonPath.<String>read(result.getResponse().getContentAsString(), "$.code")).isEqualTo("INVALID_TOKEN");
            }
            assertThat(count(user)).isEqualTo(2);
            assertThat(revoked(original)).isNotNull();
        } finally { executor.shutdownNow(); assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue(); }
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void 저장_또는_커밋이_실패하면_폐기와_새_기록을_함께_롤백한다(boolean failAtCommit) throws Exception {
        AtomicBoolean flushed = new AtomicBoolean();
        AtomicBoolean commitReached = new AtomicBoolean();
        doAnswer(invocation -> {
            RefreshToken next = invocation.getArgument(0);
            em.persist(next); em.flush();
            assertThat(jdbc.queryForObject("select revoked_at from refresh_token where token_hash=?", LocalDateTime.class, hasher.hash(original))).isNotNull();
            flushed.set(true);
            if (!failAtCommit) throw new DataIntegrityViolationException("forced-refresh-save-failure");
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void beforeCommit(boolean readOnly) {
                    commitReached.set(true);
                    throw new DataIntegrityViolationException("forced-refresh-commit-failure");
                }
            });
            return next;
        }).when(records).save(any(RefreshToken.class));
        refresh(original).andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("INTERNAL_SERVER_ERROR"));
        assertThat(flushed).isTrue();
        assertThat(commitReached.get()).isEqualTo(failAtCommit);
        unchanged();
    }

    @Test
    void JSON_오류_로그에_토큰_원문을_남기지_않는다(CapturedOutput output) throws Exception {
        String secret = "private-refresh-log-sentinel";
        mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content("{\"refreshToken\":{\"value\":\"" + secret + "\"}}"))
                .andExpect(status().isBadRequest());
        assertThat(output.getAll()).contains("Invalid refresh request").doesNotContain(secret);
        unchanged();
    }

    private String issue(User owner, String device) {
        IssuedToken issued = tokens.createRefreshToken(owner);
        transactions.execute(status -> records.saveAndFlush(RefreshToken.builder().user(owner)
                .tokenHash(hasher.hash(issued.value())).expiresAt(LocalDateTime.ofInstant(issued.expiresAt(), ZONE)).deviceInfo(device).build()));
        return issued.value();
    }
    private String body(String raw) { return "{\"refreshToken\":\"" + raw + "\"}"; }
    private ResultActions refresh(String raw) throws Exception { return mvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body(raw))); }
    private void invalid(String raw, String code) throws Exception {
        refresh(raw).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.message").value(code.equals("EXPIRED_TOKEN") ? "만료된 토큰입니다." : "유효하지 않은 토큰입니다."));
    }
    private int count(User target) { return jdbc.queryForObject("select count(*) from refresh_token where user_id=?", Integer.class, target.getId()); }
    private LocalDateTime revoked(String raw) { return jdbc.queryForObject("select revoked_at from refresh_token where token_hash=?", LocalDateTime.class, hasher.hash(raw)); }
    private void unchanged() { assertThat(count(user)).isEqualTo(1); assertThat(revoked(original)).isNull(); }

    @TestConfiguration
    static class ProbeConfig {
        @Bean ProbeController refreshProbeController() { return new ProbeController(); }
    }
    @RestController
    static class ProbeController {
        @GetMapping(PROBE)
        Map<String, Object> me(@AuthenticationPrincipal AuthUser auth) { return Map.of("userId", auth.userId(), "role", auth.role().name()); }
    }
}
