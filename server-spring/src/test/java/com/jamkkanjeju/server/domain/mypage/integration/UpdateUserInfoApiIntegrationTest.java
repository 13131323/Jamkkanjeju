package com.jamkkanjeju.server.domain.mypage.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.onboarding.entity.*;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** 실제 요청·선택 관계·배정 결과와 요청 트랜잭션의 실패 롤백을 검증한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class UpdateUserInfoApiIntegrationTest extends MySqlIntegrationTestSupport {
    private static final String URL = "/api/v2/users/me/profile";
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtTokenProvider tokens;
    @Autowired PlatformTransactionManager transactions;

    @Test
    void 닉네임만수정하고_생략한값과다른사용자및보유상태를유지한다() throws Exception {
        User first = user(true);
        select(first);
        User other = user(true);
        var otherBefore = snapshot(other);
        var immutable = immutableState(first);
        Long resultId = resultId(first);
        change(first, "{\"nickname\":\" 새이름 \"}");
        assertThat(info(first)).containsEntry("nickname", "새이름").containsEntry("targetStepCount", 12345)
                .containsEntry("transportation", "WALK").containsEntry("travelStyle", "RIGHT_HERE");
        assertThat(info(first).get("expectations")).isEqualTo(List.of("PHOTO"));
        assertThat(resultId(first)).isEqualTo(resultId);
        assertThat(snapshot(other)).isEqualTo(otherBefore);
        assertThat(immutableState(first)).isEqualTo(immutable);
        mvc.perform(get("/api/v2/users/me/mypage").header("Authorization", token(first)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.profile.nickname").value("새이름"));
    }

    @Test
    void 목표만변경하며_중복닉네임도허용한다() throws Exception {
        User first = user(true);
        User other = user(true);
        Long assigned = resultId(first);
        change(first, "{\"targetStepCount\":100000}");
        change(first, "{\"nickname\":\"여행자\"}");
        assertThat(info(first)).containsEntry("targetStepCount", 100000).containsEntry("nickname", "여행자");
        assertThat(info(other)).containsEntry("nickname", "여행자");
        assertThat(resultId(first)).isEqualTo(assigned);
        mvc.perform(get("/api/v2/users/me/mypage").header("Authorization", token(first)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.dailyStep.targetStepCount").value(100000));
    }

    @Test
    void 기대항목은전체교체하며_일부겹친항목은중복하지않는다() throws Exception {
        User user = user(false);
        select(user);
        change(user, "{\"expectations\":[\"PHOTO\",\"CAFE\"]}");
        assertGeneralResult(user);
        change(user, "{\"expectations\":[\"LOCAL\",\"CAFE\"]}");
        assertThat(((List<?>) info(user).get("expectations")).stream().map(Object::toString).toList())
                .containsExactlyInAnyOrder("LOCAL", "CAFE");
        assertThat(info(user)).containsEntry("transportation", "WALK").containsEntry("travelStyle", "RIGHT_HERE");
        Long assigned = resultId(user);
        change(user, "{\"expectations\":[\"CAFE\",\"LOCAL\"]}");
        change(user, "{\"expectations\":[\"CAFE\",\"LOCAL\"]}");
        assertThat(resultId(user)).isEqualTo(assigned);
        assertThat(jdbc.queryForObject("select count(*) from user_expectation where user_id=?", Integer.class, user.getId()))
                .isEqualTo(2);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"transportation\":\"BUS\"}", "{\"travelStyle\":\"NEAR_AROUND\"}"})
    void 단일선택만변경해도_다른선택을유지하고재배정한다(String body) throws Exception {
        User user = user(false);
        select(user);
        change(user, body);
        assertGeneralResult(user);
        assertThat(info(user).get("expectations")).isEqualTo(List.of("PHOTO"));
        assertThat(info(user)).containsEntry("transportation", body.contains("BUS") ? "BUS" : "WALK")
                .containsEntry("travelStyle", body.contains("NEAR_AROUND") ? "NEAR_AROUND" : "RIGHT_HERE");
    }

    @Test
    void 선택해제는생략과다르고_모두해제하면여행자를배정한다() throws Exception {
        User user = user(true);
        select(user);
        change(user, "{\"expectations\":[]}");
        assertThat((List<?>) info(user).get("expectations")).isEmpty();
        assertThat(info(user)).containsEntry("transportation", "WALK").containsEntry("travelStyle", "RIGHT_HERE");
        assertGeneralResult(user);
        change(user, "{\"transportation\":null,\"travelStyle\":null}");
        assertThat(info(user)).containsEntry("userType", "여행자").containsEntry("transportation", null)
                .containsEntry("travelStyle", null);
        assertThat(jdbc.queryForObject("select count(*) from user_transportation where user_id=?", Integer.class, user.getId())).isZero();
        assertThat(jdbc.queryForObject("select count(*) from user_travel_style where user_id=?", Integer.class, user.getId())).isZero();
    }

    @Test
    void 미배정사용자의빈요청과같은선택은배정하지않고_새선택은관계를생성한다() throws Exception {
        User user = user(false);
        var before = snapshot(user);
        change(user, "{}");
        change(user, "{\"expectations\":[],\"transportation\":null,\"travelStyle\":null}");
        assertThat(snapshot(user)).isEqualTo(before);
        change(user, "{\"transportation\":\"BICYCLE\",\"travelStyle\":\"NEAR_DESTINATION\"}");
        assertGeneralResult(user);
        assertThat(info(user)).containsEntry("transportation", "BICYCLE").containsEntry("travelStyle", "NEAR_DESTINATION");
        Long assigned = resultId(user);
        change(user, "{\"transportation\":\"BICYCLE\",\"travelStyle\":\"NEAR_DESTINATION\"}");
        assertThat(resultId(user)).isEqualTo(assigned);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"nickname\":null}", "{\"nickname\":\" \"}", "{\"nickname\":\"123456789012345678901\"}",
            "{\"expectations\":null}", "{\"expectations\":[\"PHOTO\",\"PHOTO\"]}", "{\"expectations\":[null]}",
            "{\"transportation\":[\"WALK\"]}", "{\"travelStyle\":\"INVALID\"}", "{\"targetStepCount\":null}",
            "{\"targetStepCount\":0}", "{\"targetStepCount\":100001}", "{\"targetStepCount\":1.5}",
            "{\"targetStepCount\":\"1000\"}", "{\"targetStepCount\":true}", "{\"userType\":\"여행자\"}",
            "{\"providedFields\":[]}", "[]", "null", "{"})
    void 잘못된요청은공통400이며_기존상태를보존한다(String body) throws Exception {
        User user = user(true);
        select(user);
        var before = snapshot(user);
        mvc.perform(patch(URL).header("Authorization", token(user)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.message").value("요청값이 올바르지 않습니다."));
        assertThat(snapshot(user)).isEqualTo(before);
    }

    @Test
    void 본문생략은공통400이고_인증누락과잘못된토큰및삭제사용자는공통401이다() throws Exception {
        User user = user(false);
        var before = snapshot(user);
        mvc.perform(patch(URL).header("Authorization", token(user)).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        mvc.perform(patch(URL).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(patch(URL).header("Authorization", "Bearer invalid").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
        assertThat(snapshot(user)).isEqualTo(before);
        String header = token(user);
        jdbc.update("delete from user where id=?", user.getId());
        em.clear();
        mvc.perform(patch(URL).header("Authorization", header).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void 배정실패는공통500이며_실제요청트랜잭션의관계변경을롤백한다() throws Exception {
        // 외부 테스트 트랜잭션 없이 호출하여 요청 서비스의 실제 롤백 결과를 별도 연결로 확인한다.
        User user = new TransactionTemplate(transactions).execute(status -> {
            User created = user(false);
            select(created);
            return created;
        });
        List<Map<String, Object>> results = jdbc.queryForList("select id,user_type from onboarding_result");
        try {
            jdbc.update("update onboarding_result set user_type='여행자'");
            var before = snapshot(user);
            mvc.perform(patch(URL).header("Authorization", token(user)).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"nickname\":\"실패할이름\",\"targetStepCount\":20000,\"expectations\":[\"CAFE\"],\"transportation\":\"BUS\"}"))
                    .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("INTERNAL_SERVER_ERROR"));
            assertThat(snapshot(user)).isEqualTo(before);
        } finally {
            for (var result : results) {
                jdbc.update("update onboarding_result set user_type=? where id=?", result.get("user_type"), result.get("id"));
            }
            for (String table : List.of("user_expectation", "user_transportation", "user_travel_style")) {
                jdbc.update("delete from " + table + " where user_id=?", user.getId());
            }
            jdbc.update("delete from user where id=?", user.getId());
        }
    }

    @Test
    void 스웨거는다섯입력필드와204를문서화하고_기존온보딩경로를유지한다() throws Exception {
        String json = mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Map<String, Object> fields = JsonPath.read(json, "$.components.schemas.UpdateUserInfoRequest.properties");
        assertThat(fields).containsOnlyKeys("nickname", "expectations", "transportation", "travelStyle", "targetStepCount");
        mvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/v2/users/me/profile'].patch.responses['204']").exists())
                .andExpect(jsonPath("$.paths['/api/v2/users/me'].patch").exists());
    }

    private User user(boolean assigned) {
        User user = User.builder().email(UUID.randomUUID() + "@example.com").passwordHash("test")
                .nickname("여행자").point(77).targetStep(12345)
                .onboardingResult(assigned ? em.find(OnboardingResult.class, 2L) : null).build();
        em.persist(user);
        em.flush();
        return user;
    }

    private void select(User user) {
        User managed = em.find(User.class, user.getId());
        em.persist(UserExpectation.builder().user(managed).expectation(em.find(Expectation.class, 1L)).build());
        em.persist(UserTransportation.builder().user(managed).transportation(em.find(Transportation.class, 1L)).build());
        em.persist(UserTravelStyle.builder().user(managed).travelStyle(em.find(TravelStyle.class, 1L)).build());
        em.flush();
        em.clear();
    }

    private String token(User user) {
        return "Bearer " + tokens.createAccessToken(user).value();
    }

    private void change(User user, String body) throws Exception {
        mvc.perform(patch(URL).header("Authorization", token(user)).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        em.flush();
        em.clear();
    }

    private Map<String, Object> info(User user) throws Exception {
        String json = mvc.perform(get("/api/v2/users/me").header("Authorization", token(user))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return JsonPath.read(json, "$");
    }

    private Long resultId(User user) {
        return jdbc.queryForObject("select onboarding_result_id from user where id=?", Long.class, user.getId());
    }

    private void assertGeneralResult(User user) throws Exception {
        assertThat(info(user).get("userType")).isNotNull().isNotEqualTo("여행자");
        assertThat(info(user).get("characterImgUrl")).isEqualTo(
                jdbc.queryForObject("select profile_img_url from onboarding_result where id=?", String.class, resultId(user)));
    }

    private Map<String, Object> immutableState(User user) {
        Map<String, Object> state = new LinkedHashMap<>(jdbc.queryForMap(
                "select point,guestbook_last_checked_at from user where id=?", user.getId()));
        for (String table : List.of("acquired_ar_character", "acquired_coupon", "mission_reward_status")) {
            state.put(table, jdbc.queryForList("select * from " + table + " where user_id=?", user.getId()));
        }
        return state;
    }

    private Map<String, Object> snapshot(User user) {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("user", jdbc.queryForMap("select * from user where id=?", user.getId()));
        for (String table : List.of("user_expectation", "user_transportation", "user_travel_style")) {
            state.put(table, jdbc.queryForList("select * from " + table + " where user_id=?", user.getId()));
        }
        state.put("immutable", immutableState(user));
        return state;
    }
}
