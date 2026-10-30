package com.jamkkanjeju.server.domain.mypage.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.domain.auth.config.JwtProperties;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** 실제 JWT·임시 MySQL로 엽서 요소의 필터·정렬·보상·읽기 전용 계약을 검증한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class GetTravelEndingElementsApiIntegrationTest extends MySqlIntegrationTestSupport {
    private static final String URL = "/api/v2/users/me/travel-ending-elements";
    private static final String EARLY = "2026-10-01 08:00:00";
    private static final String TIME = "2026-10-01 09:00:00";
    private static final String LATE = "2026-10-01 10:00:00";
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtTokenProvider tokens;
    @Autowired SecretKey signingKey;
    @Autowired JwtProperties jwtProperties;

    @Test
    void 내역이없으면실제포인트와빈배열을반환하고_사진필드는없다() throws Exception {
        User user = user();
        Map<String, Object> response = response(user);
        assertThat(response).containsOnlyKeys("point", "visitedLocationCount", "visitedLocations", "completedMissionCount", "completedMissions");
        assertThat(response).containsEntry("point", 321).containsEntry("visitedLocationCount", 0).containsEntry("completedMissionCount", 0);
        assertThat((List<?>) response.get("visitedLocations")).isEmpty();
        assertThat((List<?>) response.get("completedMissions")).isEmpty();
    }

    @Test
    void 방문장소는최근방문과동률장소ID순이며_재방문과다른사용자를구분한다() throws Exception {
        User user = user();
        User other = user();
        visit(user, 1, EARLY); visit(user, 2, TIME); visit(user, 3, TIME); visit(other, 4, LATE);
        assertThat(ids(response(user), "visitedLocations", "id")).containsExactly(3L, 2L, 1L);
        jdbc.update("update visited_location set last_visited_at=? where user_id=? and location_id=1", LATE, user.getId());
        var result = response(user);
        assertThat(ids(result, "visitedLocations", "id")).containsExactly(1L, 3L, 2L);
        assertThat(result.get("visitedLocationCount")).isEqualTo(3);
        assertThat(ids(response(other), "visitedLocations", "id")).containsExactly(4L);
    }

    @Test
    void 세유형을완료시각과유형및ID로정렬하고_협동은가장최근한건만반환한다() throws Exception {
        User user = user();
        culture(user, 1, "COMPLETED", LATE);
        culture(user, 2, "COMPLETED", TIME);
        culture(user, 3, "COMPLETED", TIME);
        treasure(user, "COMPLETED", TIME);
        cooperative(user, "ACCEPTED", "COMPLETED", EARLY);
        cooperative(user, "ACCEPTED", "COMPLETED", TIME);
        var result = response(user);
        assertThat(ids(result, "completedMissions", "missionId")).containsExactly(1L, 31L, 2L, 3L, 32L);
        assertThat(result.get("completedMissionCount")).isEqualTo(5);
        var missions = missions(result);
        assertThat(missions.get(0)).containsEntry("missionType", "CULTURE").containsEntry("completedLocation", null);
        assertThat(missions.get(1)).containsEntry("missionType", "COOPERATIVE");
        assertThat(LocalDateTime.parse((String) missions.get(1).get("completedAt")))
                .isEqualTo(LocalDateTime.of(2026, 10, 1, 9, 0));
        assertThat(missions.get(4).get("completedLocation")).isEqualTo(
                jdbc.queryForObject("select title from location where id=1", String.class));
    }

    @ParameterizedTest
    @ValueSource(strings = {"culture_mission", "treasure_mission", "cooperative_mission"})
    void 각유형의비활성미션을제외한뒤목록길이로센다(String table) throws Exception {
        User user = user();
        allCompleted(user);
        long excludedId = table.equals("culture_mission") ? 1L : table.equals("treasure_mission") ? 32L : 31L;
        jdbc.update("update " + table + " set status='INACTIVE' where mission_id=?", excludedId);
        var result = response(user);
        assertThat(ids(result, "completedMissions", "missionId")).hasSize(2).doesNotContain(excludedId);
        assertThat(result.get("completedMissionCount")).isEqualTo(2);
    }

    @ParameterizedTest
    @CsvSource({"COMPLETED,false", "IN_PROGRESS,true"})
    void 완료시각이없거나_재시작해진행중이면_모든유형을제외한다(String status, boolean dated) throws Exception {
        User user = user();
        String time = dated ? TIME : null;
        culture(user, 1, status, time);
        treasure(user, status, time);
        cooperative(user, "ACCEPTED", status, time);
        assertThat(missions(response(user))).isEmpty();
    }

    @Test
    void 협동은본인이수락한완료팀만포함한다() throws Exception {
        User user = user();
        User other = user();
        cooperative(user, "ACCEPTED", "COMPLETED", EARLY);
        cooperative(user, "PENDING", "COMPLETED", LATE);
        cooperative(user, "ACCEPTED", "IN_PROGRESS", LATE);
        cooperative(other, "ACCEPTED", "COMPLETED", LATE);
        var result = missions(response(user));
        assertThat(result).hasSize(1);
        assertThat(LocalDateTime.parse((String) result.getFirst().get("completedAt")))
                .isEqualTo(LocalDateTime.of(2026, 10, 1, 8, 0));
    }

    @Test
    void 장소연결이없는보물과협동은제외하고_문화는장소null로유지한다() throws Exception {
        User user = user();
        allCompleted(user);
        jdbc.update("update treasure_mission set location_id=null where mission_id=32");
        jdbc.update("update cooperative_mission set location_id=null where mission_id=31");
        var result = missions(response(user));
        assertThat(result).hasSize(1);
        assertThat(result.getFirst()).containsEntry("missionId", 1).containsEntry("completedLocation", null);
    }

    @Test
    void 전체보상설정과본인지급플래그를유지하고_상태없음은미수령이다() throws Exception {
        User user = user();
        User other = user();
        allCompleted(user);
        jdbc.update("update treasure_mission set ar_character_id=6,point=0,coupon_id=5 where mission_id=32");
        jdbc.update("update coupon set location_id=null where id=5");
        rewardStatus(user, 32, false, true, true);
        rewardStatus(other, 32, true, false, false);
        var result = response(user);
        Map<String, Object> treasure = reward(result, 32L);
        // 실제 JSON 객체를 통해 이미 받은 보상도 제거하지 않는지 확인한다.
        assertThat(object(treasure.get("point"))).containsEntry("amount", 0).containsEntry("isReceived", true);
        assertThat(object(treasure.get("arCharacter"))).containsEntry("id", 6).containsEntry("isReceived", false);
        assertThat(object(treasure.get("coupon"))).containsEntry("isReceived", true).containsEntry("couponLocation", null);
        Map<String, Object> cooperative = reward(result, 31L);
        for (String field : List.of("arCharacter", "point", "coupon")) {
            assertThat(object(cooperative.get(field))).containsEntry("isReceived", false);
        }
    }

    @Test
    void 보상이없어도상세객체를유지하고_중단에준하는부분성공완료도반환한다() throws Exception {
        User user = user();
        culture(user, 1, "COMPLETED", TIME);
        jdbc.update("update culture_mission set ar_character_id=null,point=null,coupon_id=null where mission_id=1");
        jdbc.update("update culture_mission_progress set correct_count=0 where user_id=?", user.getId());
        Map<String, Object> result = missions(response(user)).getFirst();
        @SuppressWarnings("unchecked") var reward = (Map<String, Object>) result.get("rewardDetail");
        assertThat(reward).containsOnlyKeys("arCharacter", "point", "coupon")
                .containsEntry("arCharacter", null).containsEntry("point", null).containsEntry("coupon", null);
    }

    @Test
    void 반복조회는사용자와방문진행보상획득상태를변경하지않는다() throws Exception {
        User user = user();
        allCompleted(user);
        visit(user, 1, TIME);
        rewardStatus(user, 1, true, false, false);
        var before = snapshot(user);
        assertThat(response(user)).isEqualTo(response(user));
        assertThat(snapshot(user)).isEqualTo(before);
    }

    @Test
    void 인증누락과잘못된토큰_만료토큰_삭제사용자는공통401이다() throws Exception {
        User user = user();
        var before = snapshot(user);
        mvc.perform(get(URL)).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(get(URL).header("Authorization", "Bearer invalid"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
        var expiredTokens = new JwtTokenProvider(signingKey, jwtProperties,
                Clock.fixed(Instant.parse("2000-01-01T00:00:00Z"), ZoneOffset.UTC));
        mvc.perform(get(URL).header("Authorization", "Bearer " + expiredTokens.createAccessToken(user).value()))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("EXPIRED_TOKEN"));
        assertThat(snapshot(user)).isEqualTo(before);
        String header = header(user);
        jdbc.update("delete from user where id=?", user.getId());
        em.clear();
        mvc.perform(get(URL).header("Authorization", header))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void 스웨거는전용응답과전체보상구조를문서화한다() throws Exception {
        String json = mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        Map<String, Object> fields = JsonPath.read(json, "$.components.schemas.GetTravelEndingElementsResponse.properties");
        assertThat(fields).containsOnlyKeys("point", "visitedLocationCount", "visitedLocations", "completedMissionCount", "completedMissions");
        mvc.perform(get("/v3/api-docs")).andExpect(jsonPath("$.paths['" + URL + "'].get.responses['200']").exists())
                .andExpect(jsonPath("$.components.schemas.TravelEndingCompletedMissionInfo.properties.rewardDetail").exists())
                .andExpect(jsonPath("$.components.schemas.TravelEndingVisitedLocationInfo.properties.locationTitle").exists());
    }

    private User user() {
        User user = User.builder().email(UUID.randomUUID() + "@example.com").passwordHash("test").point(321).build();
        em.persist(user); em.flush(); return user;
    }

    private void culture(User user, int missionId, String status, String time) {
        jdbc.update("insert into culture_mission_progress(culture_mission_id,user_id,mission_status,current_quiz_index,correct_count,last_completed_at) values(?,?,?,3,1,?)",
                missionId, user.getId(), status, time);
    }

    private void treasure(User user, String status, String time) {
        jdbc.update("insert into treasure_mission_progress(treasure_mission_id,user_id,mission_status,found_item_count,completed_at) values(32,?,?,1,?)",
                user.getId(), status, time);
    }

    private void cooperative(User user, String accepted, String status, String time) {
        String token = UUID.randomUUID().toString();
        jdbc.update("insert into cooperative_mission_progress(cooperative_mission_id,current_step,mission_status,team_token,completed_at) values(31,3,?,?,?)", status, token, time);
        Long id = jdbc.queryForObject("select id from cooperative_mission_progress where team_token=?", Long.class, token);
        jdbc.update("insert into cooperative_mission_participant(cooperative_mission_progress_id,user_id,participant_status,participant_role,joined_at) values(?,?,?,'HOST',?)",
                id, user.getId(), accepted, TIME);
    }

    private void allCompleted(User user) {
        culture(user, 1, "COMPLETED", TIME);
        treasure(user, "COMPLETED", TIME);
        cooperative(user, "ACCEPTED", "COMPLETED", TIME);
    }

    private void visit(User user, int locationId, String time) {
        jdbc.update("insert into visited_location(user_id,location_id,last_visited_at) values(?,?,?)", user.getId(), locationId, time);
    }

    private void rewardStatus(User user, int mission, boolean ar, boolean point, boolean coupon) {
        jdbc.update("insert into mission_reward_status(user_id,mission_id,ar_character_reward_granted,point_reward_granted,coupon_reward_granted) values(?,?,?,?,?)",
                user.getId(), mission, ar, point, coupon);
    }

    private String header(User user) { return "Bearer " + tokens.createAccessToken(user).value(); }

    private String body(User user) throws Exception {
        em.clear();
        return mvc.perform(get(URL).header("Authorization", header(user))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private Map<String, Object> response(User user) throws Exception { return JsonPath.read(body(user), "$"); }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> missions(Map<String, Object> result) {
        return (List<Map<String, Object>>) result.get("completedMissions");
    }

    @SuppressWarnings("unchecked")
    private List<Long> ids(Map<String, Object> result, String list, String id) {
        return ((List<Map<String, Object>>) result.get(list)).stream().map(row -> ((Number) row.get(id)).longValue()).toList();
    }

    private Map<String, Object> reward(Map<String, Object> result, long id) {
        return object(missions(result).stream().filter(mission -> ((Number) mission.get("missionId")).longValue() == id)
                .findFirst().orElseThrow().get("rewardDetail"));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> object(Object value) { return (Map<String, Object>) value; }

    private Map<String, Object> snapshot(User user) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("user", jdbc.queryForMap("select * from user where id=?", user.getId()));
        for (String table : List.of("visited_location", "culture_mission_progress", "treasure_mission_progress",
                "cooperative_mission_participant", "mission_reward_status", "acquired_coupon", "acquired_ar_character")) {
            result.put(table, jdbc.queryForList("select * from " + table + " where user_id=?", user.getId()));
        }
        return result;
    }
}
