package com.jamkkanjeju.server.domain.agent.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** 실제 임시 MySQL에서 감성 분석 입력과 전용 인증을 검증한다. */
@SpringBootTest(properties = {"app.agent.token=guestbook-analysis-test", "app.blob-storage.container=agent-test"})
@AutoConfigureMockMvc
@Transactional
class GetAgentGuestbooksApiIntegrationTest extends MySqlIntegrationTestSupport {
    private static final String URL = "/api/v2/agent/guestbooks";
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @Test
    void 활성_장소_방명록만_페이지_조회하고_데이터를_바꾸지_않는다() throws Exception {
        jdbc.update("update guestbook set status='INACTIVE'");
        Long visit = jdbc.queryForObject("select min(id) from visited_location", Long.class);
        assertThat(visit).isNotNull();
        Long location = jdbc.queryForObject("select location_id from visited_location where id=?", Long.class, visit);
        for (int i = 0; i < 5; i++) {
            jdbc.update("insert into guestbook(id, visited_at, saved_at, status, content_writing) values (?, '2026-11-19', '2026-11-19 10:00:00', ?, ?)",
                    900001L + i, i == 3 ? "INACTIVE" : "ACTIVE", i == 1 ? null : "분석 입력");
            jdbc.update("insert into location_guestbook(guestbook_id, visited_location_id) values (?, ?)",
                    900001L + i, i == 4 ? null : visit);
        }
        Long before = jdbc.queryForObject("select count(*) from guestbook", Long.class);
        List<Long> actual = new ArrayList<>();
        for (int page = 0; page < 2; page++) {
            String body = mvc.perform(get(URL).header("X-Agent-Token", "guestbook-analysis-test")
                            .param("page", String.valueOf(page)).param("size", "2"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.guestbooksPage.hasNext").value(page == 0))
                    .andExpect(jsonPath("$.guestbooks[0].locationId").value(location)).andReturn().getResponse().getContentAsString();
            List<Number> ids = JsonPath.read(body, "$.guestbooks[*].guestbookId");
            actual.addAll(ids.stream().map(Number::longValue).toList());
            if (page == 0) {
                Object text = JsonPath.read(body, "$.guestbooks[1].text");
                assertThat(text).isNull();
            }
        }
        assertThat(actual).containsExactly(900001L, 900002L, 900003L);
        assertThat(jdbc.queryForObject("select count(*) from guestbook", Long.class)).isEqualTo(before);
        assertThat(jdbc.queryForObject("select content_writing from guestbook where id=900001", String.class)).isEqualTo("분석 입력");
    }

    @Test
    void 기본_페이지와_빈_범위를_반환한다() throws Exception {
        mvc.perform(get(URL).header("X-Agent-Token", "guestbook-analysis-test"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.guestbooksPage.page").value(0))
                .andExpect(jsonPath("$.guestbooksPage.size").value(100));
        mvc.perform(get(URL).header("X-Agent-Token", "guestbook-analysis-test").param("page", "1000000"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.guestbooks").isEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"page=-1", "size=0", "size=101", "size=text"})
    void 입력_오류를_거부한다(String query) throws Exception {
        String[] pair = query.split("=");
        mvc.perform(get(URL).header("X-Agent-Token", "guestbook-analysis-test").param(pair[0], pair[1]))
                .andExpect(status().isBadRequest());
    }

    @Test
    void 고정_토큰_없는_접근을_거부한다() throws Exception {
        mvc.perform(get(URL)).andExpect(status().isUnauthorized());
        mvc.perform(get(URL).header("X-Agent-Token", "wrong")).andExpect(status().isUnauthorized());
    }
}
