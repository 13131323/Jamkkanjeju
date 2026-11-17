package com.jamkkanjeju.server.domain.etc.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jamkkanjeju.server.domain.etc.service.MaintenanceScheduler;
import com.jamkkanjeju.server.domain.etc.service.MaintenanceStateService;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** 임시 MySQL에서 점검 시간 경계·복구·보안 체인 연결을 검증한다. */
@SpringBootTest(properties = {"app.agent.token=maintenance-test-token", "app.blob-storage.container=maintenance-test"})
@AutoConfigureMockMvc
@Transactional
class MaintenanceIntegrationTest extends MySqlIntegrationTestSupport {
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 1, 31, 23, 30);
    @Autowired JdbcTemplate jdbc;
    @Autowired MaintenanceStateService service;
    @Autowired MaintenanceScheduler scheduler;
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JwtTokenProvider jwt;

    @TestConfiguration
    static class FixedTime {
        @Bean @Primary
        Clock maintenanceClock() {
            // UTC Clock에서도 KST 날짜와 시각을 정확히 사용해야 한다.
            return Clock.fixed(Instant.parse("2026-01-31T14:30:00Z"), ZoneOffset.UTC);
        }
    }

    @ParameterizedTest
    @CsvSource({"60,120,SCHEDULED,false", "0,60,IN_PROGRESS,true",
            "-60,0,COMPLETED,false", "-120,-60,COMPLETED,false"})
    void 스케줄러는_시작_종료_경계와_지난_예약을_반영한다(int startMinutes, int endMinutes,
                                               String expected, boolean blocked) {
        long id = insert("SCHEDULED", NOW.plusMinutes(startMinutes), NOW.plusMinutes(endMinutes));
        scheduler.updateMaintenanceStatus();
        assertThat(state(id)).isEqualTo(expected);
        assertThat(service.isInProgress()).isEqualTo(blocked);
    }

    @ParameterizedTest
    @ValueSource(strings = {"CANCELLED", "FAILED", "COMPLETED"})
    void 종료_실패_취소_상태는_변경하지_않는다(String original) {
        long id = insert(original, NOW.minusHours(1), NOW.plusHours(1));
        scheduler.updateMaintenanceStatus();
        assertThat(state(id)).isEqualTo(original);
        assertThat(service.isInProgress()).isFalse();
    }

    @Test
    void 중첩_예약은_유효한_점검이_남아있으면_차단하고_반복해도_새_행을_만들지_않는다() {
        long expired = insert("IN_PROGRESS", NOW.minusHours(2), NOW);
        long active = insert("SCHEDULED", NOW, NOW.plusHours(1));
        long count = jdbc.queryForObject("select count(*) from maintenance", Long.class);
        assertThat(service.isInProgress()).isTrue();
        scheduler.updateMaintenanceStatus();
        assertThat(state(expired)).isEqualTo("COMPLETED");
        assertThat(state(active)).isEqualTo("IN_PROGRESS");
        assertThat(jdbc.queryForObject("select count(*) from maintenance", Long.class)).isEqualTo(count);
    }

    @Test
    void 일반_API는_JWT_검사보다_먼저_점검_응답으로_차단한다() throws Exception {
        insert("SCHEDULED", NOW, NOW.plusHours(1));
        mvc.perform(get("/api/v2/map"))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("SERVICE_UNDER_MAINTENANCE"));
        mvc.perform(post("/api/v2/users/me/home"))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void 허용_API도_기존_인증과_입력_검증을_유지한다() throws Exception {
        insert("SCHEDULED", NOW, NOW.plusHours(1));
        mvc.perform(get("/api/v2/users/me/home").param("latitude", "33.5").param("longitude", "126.5"))
                .andExpect(status().isUnauthorized());
        User user = users.saveAndFlush(User.builder().nickname("점검 확인 사용자")
                .email("maintenance-home@example.com").passwordHash("unused-in-test")
                .guestbookLastCheckedAt(NOW.minusDays(1)).build());
        String token = jwt.createAccessToken(user).value();
        mvc.perform(get("/api/v2/users/me/home").param("latitude", "33.5").param("longitude", "126.5")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maintenance.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.maintenance.message").value("점검 테스트"));
        mvc.perform(post("/api/v2/auth/login").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v2/auth/refresh").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 점검_중에도_고정_토큰으로_인증한_에이전트_조회는_가능하다() throws Exception {
        insert("SCHEDULED", NOW, NOW.plusHours(1));
        mvc.perform(get("/api/v2/agent/locations").header("X-Agent-Token", "maintenance-test-token"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v2/agent/locations")).andExpect(status().isUnauthorized());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"startsAt\":null}"})
    void 예약_API는_시각이_없으면_서버_KST_1시간_뒤로_저장한다(String body) throws Exception {
        mvc.perform(post("/api/v2/agent/maintenances").header("X-Agent-Token", "maintenance-test-token")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.startsAt").value("2026-02-01T00:30:00"))
                .andExpect(jsonPath("$.endsAt").value("2026-02-01T01:30:00"))
                .andExpect(jsonPath("$.status").value("SCHEDULED"));
    }

    @Test
    void 예약_API는_지정한_시각을_DB와_응답에_그대로_사용한다() throws Exception {
        mvc.perform(post("/api/v2/agent/maintenances").header("X-Agent-Token", "maintenance-test-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"시각 지정 테스트\",\"startsAt\":\"2026-02-01T15:27:00\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.startsAt").value("2026-02-01T15:27:00"))
                .andExpect(jsonPath("$.endsAt").value("2026-02-01T16:27:00"));
        assertThat(jdbc.queryForObject("select starts_at from maintenance where message = ?",
                LocalDateTime.class, "시각 지정 테스트")).isEqualTo(LocalDateTime.of(2026, 2, 1, 15, 27));
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"startsAt\":\"invalid\"}", "{\"startsAt\":\"2026-02-30T15:27:00\"}", "{\"startsAt\":123}"})
    void 잘못된_시각은_400이며_예약을_추가하지_않는다(String body) throws Exception {
        long count = jdbc.queryForObject("select count(*) from maintenance", Long.class);
        mvc.perform(post("/api/v2/agent/maintenances").header("X-Agent-Token", "maintenance-test-token")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("select count(*) from maintenance", Long.class)).isEqualTo(count);
    }

    private long insert(String status, LocalDateTime startsAt, LocalDateTime endsAt) {
        jdbc.update("insert into maintenance(message, starts_at, ends_at, status) values (?, ?, ?, ?)",
                "점검 테스트", startsAt, endsAt, status);
        return jdbc.queryForObject("select last_insert_id()", Long.class);
    }

    private String state(long id) {
        return jdbc.queryForObject("select status from maintenance where id = ?", String.class, id);
    }
}
