package com.jamkkanjeju.server.domain.agent.integration;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.auth.support.AuthFixtures;
import com.jamkkanjeju.server.domain.map.repository.LocationRepository;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

/** 실행별 임시 MySQL에서 장소 페이지와 에이전트·사용자 인증의 격리를 검증한다. */
@SpringBootTest(properties = {
        "app.agent.token=agent-api-integration-secret",
        "app.blob-storage.container=agent-test",
        "spring.datasource.hikari.minimum-idle=0"
})
@AutoConfigureMockMvc
@Transactional
class GetStoredLocationsApiIntegrationTest extends MySqlIntegrationTestSupport {
    private static final String URL = "/api/v2/agent/locations";
    private static final String TOKEN = "agent-api-integration-secret";
    private static final String HEADER = "X-Agent-Token";
    private static final String PROBE = "/api/v2/test/agent-user";
    @Autowired MockMvc mvc;
    @Autowired LocationRepository locations;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtTokenProvider jwt;

    @Test
    void 기본값으로_전체_필드를_조회하고_원본_데이터는_변경하지_않는다() throws Exception {
        Map<String, Long> before = snapshot();
        var first = locations.findAllByOrderByIdAsc(org.springframework.data.domain.PageRequest.of(0, 100)).getContent().getFirst();
        mvc.perform(get(URL).header(HEADER, TOKEN)).andExpect(status().isOk())
                .andExpect(jsonPath("$.locationsPage.page").value(0))
                .andExpect(jsonPath("$.locationsPage.size").value(100))
                .andExpect(jsonPath("$.locations[0].locationId").value(first.getId()))
                .andExpect(jsonPath("$.locations[0].contentId").value(first.getContentId()))
                .andExpect(jsonPath("$.locations[0].title").value(first.getTitle()))
                .andExpect(jsonPath("$.locations[0].address").value(first.getAddress()))
                .andExpect(jsonPath("$.locations[0].category").value(first.getCategory()))
                .andExpect(jsonPath("$.locations[0].radius").value(first.getRadius()))
                .andExpect(jsonPath("$.locations[0].latitude").value(first.getLatitude()))
                .andExpect(jsonPath("$.locations[0].longitude").value(first.getLongitude()));
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 페이지를_순회하면_ID순으로_중복이나_누락_없이_장소를_얻는다() throws Exception {
        List<Long> expected = jdbc.queryForList("select id from location order by id", Long.class);
        assertThat(expected).isNotEmpty();
        List<Long> actual = new ArrayList<>();
        boolean hasNext;
        int page = 0;
        do {
            String body = mvc.perform(get(URL).header(HEADER, TOKEN).param("page", String.valueOf(page)).param("size", "7"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.locationsPage.page").value(page))
                    .andExpect(jsonPath("$.locationsPage.size").value(7)).andReturn().getResponse().getContentAsString();
            List<Number> ids = JsonPath.read(body, "$.locations[*].locationId");
            actual.addAll(ids.stream().map(Number::longValue).toList());
            hasNext = JsonPath.read(body, "$.locationsPage.hasNext");
            assertThat(ids.size()).isLessThanOrEqualTo(7);
            page++;
            assertThat(page).isLessThanOrEqualTo(expected.size() + 1);
        } while (hasNext);
        assertThat(actual).containsExactlyElementsOf(expected);
    }

    @Test
    void 범위를_넘는_페이지는_빈_결과다() throws Exception {
        mvc.perform(get(URL).header(HEADER, TOKEN).param("page", "1000000").param("size", "100"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.locations").isEmpty())
                .andExpect(jsonPath("$.locationsPage.hasNext").value(false));
    }

    @ParameterizedTest
    @ValueSource(strings = {"page=-1", "size=0", "size=101", "size=text", "page=1.5"})
    void 잘못된_페이지_입력은_400이다(String query) throws Exception {
        String[] pair = query.split("=");
        mvc.perform(get(URL).header(HEADER, TOKEN).param(pair[0], pair[1]))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void 헤더_누락은_401이다() throws Exception {
        mvc.perform(get(URL)).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "wrong", "Bearer agent-api-integration-secret"})
    void 오류_토큰은_401이다(String token) throws Exception {
        mvc.perform(get(URL).header(HEADER, token)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    }

    @Test
    void JWT만으로_에이전트_API를_호출할_수_없다() throws Exception {
        mvc.perform(get(URL).header("Authorization", "Bearer " + accessToken()))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void 에이전트_조회는_잘못된_Authorization에_영향받지_않는다() throws Exception {
        mvc.perform(get(URL).header(HEADER, TOKEN).header("Authorization", "Bearer invalid"))
                .andExpect(status().isOk());
    }

    @Test
    void 에이전트_토큰으로_일반_API를_호출할_수_없다() throws Exception {
        mvc.perform(get(PROBE).header(HEADER, TOKEN)).andExpect(status().isUnauthorized());
        mvc.perform(get(PROBE).header(HEADER, TOKEN).header("Authorization", "Bearer " + accessToken()))
                .andExpect(status().isOk());
    }

    @Test
    void 허용하지_않은_에이전트_메서드는_403이다() throws Exception {
        mvc.perform(post(URL).header(HEADER, TOKEN)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    private String accessToken() { return jwt.createAccessToken(AuthFixtures.activeUser(1L)).value(); }

    private Map<String, Long> snapshot() {
        Map<String, Long> result = new LinkedHashMap<>();
        for (String table : List.of("location", "mission", "treasure_mission_progress", "cooperative_mission_progress", "mission_reward_status", "guestbook")) {
            result.put(table, jdbc.queryForObject("select count(*) from " + table, Long.class));
        }
        return result;
    }

    @TestConfiguration
    static class ProbeConfig {
        @Bean ProbeController agentUserProbe() { return new ProbeController(); }
    }

    @RestController
    static class ProbeController {
        @GetMapping(PROBE) String me() { return "authenticated"; }
    }
}
