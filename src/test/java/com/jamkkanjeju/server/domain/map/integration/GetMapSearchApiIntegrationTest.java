package com.jamkkanjeju.server.domain.map.integration;

import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.repository.LocationRepository;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** 실제 JWT·임시 MySQL로 문자 포함 검색·Slice 경계·미션 필터와 읽기 전용을 검증한다. */
@SpringBootTest(properties = {
        "app.dev-auth.enabled=false", "app.blob-storage.container=media",
        "app.jwt.secret-key=dGVzdC1zZWNyZXQta2V5LWZvci1qd3Qtc2lnbmluZy0zMmJ5dGVzIQ==",
        "app.jwt.access-token-expiration=30m", "app.jwt.refresh-token-expiration=14d",
        "logging.level.org.hibernate.SQL=warn"
})
@AutoConfigureMockMvc
@Transactional
class GetMapSearchApiIntegrationTest extends MySqlIntegrationTestSupport {
    private static final String URL = "/api/v2/map/search";
    private static final String PREFIX = "검색검증";
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired JwtTokenProvider tokens;
    @MockitoBean Clock clock;
    @MockitoBean TourApiClient images;
    @MockitoSpyBean LocationRepository locations;
    User current;
    int sequence;

    @BeforeEach
    void setup() {
        when(clock.instant()).thenReturn(Instant.parse("2026-10-26T03:00:00Z"));
        when(clock.getZone()).thenReturn(ZoneId.of("Asia/Seoul"));
        when(images.getLocationImageUrl(anyLong())).thenReturn("representative.jpg");
        current = newUser();
    }

    private <T> T persist(T entity) { em.persist(entity); return entity; }

    private User newUser() { return persist(user(null, "search-" + (++sequence) + "@example.com")); }

    private Location place(String title, double longitude) {
        return persist(Location.builder().contentId(9_200_000_000L + (++sequence)).title(title)
                .category("관광지").address("제주 검색 주소").latitude(0).longitude(longitude).radius(100).build());
    }

    private Mission mission(MissionTypeCode code) {
        MissionType type = em.createQuery("select t from MissionType t where t.type=:type", MissionType.class)
                .setParameter("type", code).getSingleResult();
        return persist(Mission.builder().missionType(type).build());
    }

    private TreasureMission treasure(Location target, MissionActivationStatus status) {
        return persist(TreasureMission.builder().mission(mission(MissionTypeCode.TREASURE)).location(target)
                .status(status).itemTotalCount(3).build());
    }

    private CooperativeMission cooperative(Location target, MissionActivationStatus status) {
        return persist(CooperativeMission.builder().mission(mission(MissionTypeCode.COOPERATIVE)).location(target)
                .status(status).build());
    }

    private String token(User user) { return "Bearer " + tokens.createAccessToken(user).value(); }

    private MockHttpServletRequestBuilder query(String keyword) {
        return get(URL).param("keyword", keyword).param("userLatitude", "0").param("userLongitude", "0");
    }

    private ResultActions request(String keyword) throws Exception {
        return mvc.perform(query(keyword).header("Authorization", token(current)));
    }

    private String body(ResultActions response) throws Exception {
        return response.andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private List<Long> ids(String json) {
        List<Number> ids = JsonPath.read(json, "$.locations[*].locationId");
        return ids.stream().map(Number::longValue).toList();
    }

    private void reload() { em.flush(); em.clear(); }

    /** 정상·반복·오류 전후 사용자·장소·미션·방명록·보유 보상 전체 상태를 비교한다. */
    private Map<String, List<Map<String, Object>>> snapshot() {
        reload();
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        for (String table : List.of("user", "location", "visited_location", "guestbook", "location_guestbook",
                "road_guestbook", "mission", "treasure_mission", "cooperative_mission", "mission_reward_status",
                "treasure_mission_progress", "cooperative_mission_progress", "cooperative_mission_participant",
                "acquired_coupon", "acquired_ar_character")) {
            result.put(table, jdbc.queryForList("select * from " + table));
        }
        return result;
    }

    private void error(ResultActions response, int expectedStatus, String code, String message) throws Exception {
        response.andExpect(status().is(expectedStatus)).andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.message").value(message));
    }

    @Test
    void 시작_중간_끝_한글자와_내부공백을_그대로_비교하고_이름만_검색한다() throws Exception {
        Location first = place(PREFIX + " 제주 카페", 2);
        Location middle = place("앞 " + PREFIX + " 제주 카페 뒤", 1);
        Location last = place("끝 " + PREFIX, 0);
        Location addressOnly = place("이름 불일치", 0);
        cooperative(addressOnly, MissionActivationStatus.ACTIVE);
        reload();
        jdbc.update("update location set address=?, category=? where id=?", PREFIX, PREFIX, addressOnly.getId());
        jdbc.update("update mission_type set title=? where type='COOPERATIVE'", PREFIX);
        Map<String, List<Map<String, Object>>> before = snapshot();
        assertThat(ids(body(request(" \t" + PREFIX + " \n")))).containsExactly(first.getId(), middle.getId(), last.getId());
        assertThat(ids(body(request(PREFIX + " 제주 카")))).containsExactly(first.getId(), middle.getId());
        assertThat(ids(body(request(PREFIX + " 제주카")))).isEmpty();
        assertThat(ids(body(request(PREFIX + "  제주")))).isEmpty();
        assertThat(ids(body(request("검")))).contains(first.getId(), middle.getId(), last.getId()).doesNotContain(addressOnly.getId());
        assertThat(ids(body(request("앞 " + PREFIX)))).containsExactly(middle.getId());
        assertThat(snapshot()).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(strings = {"%", "_", "\\", "' OR 1=1 --"})
    void LIKE기호와_SQL모양도_문자그대로만_검색한다(String literal) throws Exception {
        Location match = place(PREFIX + literal + "문자", 0);
        place(PREFIX + "일반문자", 0);
        reload();
        assertThat(ids(body(request(PREFIX + literal)))).containsExactly(match.getId());
    }

    @Test
    void 기본20건과_다음1건_빈페이지_size변경은_ID순이며_추가행은_처리하지않는다() throws Exception {
        List<Location> places = new ArrayList<>();
        for (int i = 0; i < 21; i++) places.add(place(PREFIX + " 카페" + i, (21 - i) * .01));
        Location probe = places.getLast();
        // 다음 페이지 판정 행에 미션 중복이 있어도 첫 페이지 요청에는 영향을 주지 않는다.
        treasure(probe, MissionActivationStatus.ACTIVE);
        cooperative(probe, MissionActivationStatus.ACTIVE);
        Map<String, List<Map<String, Object>>> before = snapshot();
        String first = body(request(PREFIX).andExpect(jsonPath("$.locations.length()").value(20))
                .andExpect(jsonPath("$.locationsPage.page").value(0)).andExpect(jsonPath("$.locationsPage.size").value(20))
                .andExpect(jsonPath("$.locationsPage.hasNext").value(true)));
        assertThat(ids(first)).containsExactlyElementsOf(places.subList(0, 20).stream().map(Location::getId).toList());
        verify(images, never()).getLocationImageUrl(probe.getContentId());
        assertThat(snapshot()).isEqualTo(before);
        // 다음 페이지 자체의 검증은 정상 미션 한 건으로 전환한 뒤 확인한다.
        jdbc.update("update cooperative_mission set status='INACTIVE' where location_id=?", probe.getId());
        em.clear();
        String second = body(mvc.perform(query(PREFIX).param("page", "1").header("Authorization", token(current)))
                .andExpect(jsonPath("$.locationsPage.hasNext").value(false)));
        assertThat(ids(second)).containsExactly(probe.getId());
        assertThat(ids(second)).doesNotContainAnyElementsOf(ids(first));
        mvc.perform(query(PREFIX).param("page", "2").header("Authorization", token(current)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.locations").isEmpty())
                .andExpect(jsonPath("$.locationsPage.hasNext").value(false));
        mvc.perform(query(PREFIX).param("size", "7").header("Authorization", token(current)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.locations.length()").value(7))
                .andExpect(jsonPath("$.locationsPage.size").value(7)).andExpect(jsonPath("$.locationsPage.hasNext").value(true));
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 20})
    void 빈결과와_정확히20건이면_hasNext는_false다(int count) throws Exception {
        for (int i = 0; i < count; i++) place(PREFIX + i, 0);
        reload();
        request(PREFIX).andExpect(status().isOk()).andExpect(jsonPath("$.locations.length()").value(count))
                .andExpect(jsonPath("$.locationsPage.hasNext").value(false));
    }

    @Test
    void 두유형_완료_기지급_비활성_미션없음과_nullable을_계약대로_반환한다() throws Exception {
        Location first = place(PREFIX + " 먼곳", 1);
        Location second = place(PREFIX + " 가까운곳", .01);
        Location inactive = place(PREFIX + " 비활성", 0);
        Location none = place(PREFIX + " 미션없음", 0);
        TreasureMission treasure = treasure(first, MissionActivationStatus.ACTIVE);
        CooperativeMission cooperative = cooperative(second, MissionActivationStatus.ACTIVE);
        treasure(inactive, MissionActivationStatus.INACTIVE);
        persist(TreasureMissionProgress.builder().treasureMission(treasure).user(current)
                .missionStatus(MissionProgressStatus.COMPLETED).completedAt(TIME).build());
        MissionRewardStatus granted = persist(MissionRewardStatus.builder().mission(treasure.getMission()).user(current).build());
        granted.grantArCharacterReward(); granted.grantPointReward(); granted.grantCouponReward();
        User other = newUser();
        when(images.getLocationImageUrl(none.getContentId())).thenReturn(null);
        Map<String, List<Map<String, Object>>> before = snapshot();
        String json = body(request(PREFIX).andExpect(jsonPath("$.locations[0].mission.missionId").value(treasure.getMissionId()))
                .andExpect(jsonPath("$.locations[0].mission.missionType").value("TREASURE"))
                .andExpect(jsonPath("$.locations[0].mission.missionTitle").value(treasure.getMission().getMissionType().getTitle()))
                .andExpect(jsonPath("$.locations[1].mission.missionId").value(cooperative.getMissionId()))
                .andExpect(jsonPath("$.locations[1].mission.missionType").value("COOPERATIVE"))
                .andExpect(jsonPath("$.locations[2].mission").value(nullValue()))
                .andExpect(jsonPath("$.locations[3].mission").value(nullValue()))
                .andExpect(jsonPath("$.locations[3].representativeImageUrl").value(nullValue())));
        assertThat(ids(json)).containsExactly(first.getId(), second.getId(), inactive.getId(), none.getId());
        Map<String, Object> root = JsonPath.read(json, "$");
        assertThat(root.keySet()).containsExactlyInAnyOrder("locations", "locationsPage");
        Map<String, Object> item = JsonPath.read(json, "$.locations[3]");
        assertThat(item.keySet()).containsExactlyInAnyOrder("locationId", "locationTitle", "locationCategory", "representativeImageUrl", "distanceMeter", "mission");
        assertThat(item.get("locationTitle")).isEqualTo(none.getTitle());
        assertThat(item.get("locationCategory")).isEqualTo("관광지");
        assertThat(item.get("distanceMeter")).isEqualTo(0);
        assertThat(body(request(PREFIX))).isEqualTo(json);
        assertThat(body(mvc.perform(query(PREFIX).header("Authorization", token(other))))).isEqualTo(json);
        String moved = body(mvc.perform(query(PREFIX).param("page", "0").header("Authorization", token(current))
                .with(request -> { request.setParameter("userLongitude", "1"); return request; })));
        assertThat(ids(moved)).isEqualTo(ids(json));
        assertThat((Number) JsonPath.read(moved, "$.locations[0].distanceMeter")).isEqualTo(0);
        assertThat((Number) JsonPath.read(json, "$.locations[0].distanceMeter")).isNotEqualTo(0);
        assertThat(snapshot()).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void 같은유형과_다른유형_중복은_공통500이며_DB는_유지된다(boolean mixed) throws Exception {
        Location target = place(PREFIX, 0);
        treasure(target, MissionActivationStatus.ACTIVE);
        if (mixed) cooperative(target, MissionActivationStatus.ACTIVE);
        else treasure(target, MissionActivationStatus.ACTIVE);
        Map<String, List<Map<String, Object>>> before = snapshot();
        error(request(PREFIX), 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
        verifyNoInteractions(images);
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void DB오류는_빈결과가_아닌_공통500이며_내부메시지를_숨긴다() throws Exception {
        place(PREFIX, 0);
        Map<String, List<Map<String, Object>>> before = snapshot();
        doThrow(new IllegalStateException("내부 검색 DB 오류")).when(locations).findByTitleContainingOrderByIdAsc(anyString(), any());
        error(request(PREFIX), 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
        verifyNoInteractions(images);
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 누락_범위_변환과_페이지오류는_공통400이다() throws Exception {
        Map<String, List<Map<String, Object>>> before = snapshot();
        for (String field : List.of("keyword", "userLatitude", "userLongitude")) {
            MockHttpServletRequestBuilder builder = query(PREFIX).header("Authorization", token(current));
            builder.with(request -> { request.removeParameter(field); return request; });
            error(mvc.perform(builder), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        Map<String, List<String>> invalid = Map.of(
                "keyword", List.of("", " \t "),
                "userLatitude", List.of("-90.1", "90.1", "NaN", "Infinity", "abc"),
                "userLongitude", List.of("-180.1", "180.1", "-Infinity", "NaN"),
                "page", List.of("-1", "1.5", "abc", "2147483648"),
                "size", List.of("0", "-1", "1.5", "abc", "2147483648"));
        for (Map.Entry<String, List<String>> entry : invalid.entrySet()) {
            for (String value : entry.getValue()) {
                MockHttpServletRequestBuilder builder = query(PREFIX).header("Authorization", token(current));
                builder.with(request -> { request.setParameter(entry.getKey(), value); return request; });
                error(mvc.perform(builder), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
            }
        }
        verifyNoInteractions(images);
        verify(locations, never()).findByTitleContainingOrderByIdAsc(anyString(), any());
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 토큰없음_잘못된토큰_없는사용자는_401이며_검색하지않는다() throws Exception {
        Map<String, List<Map<String, Object>>> before = snapshot();
        error(mvc.perform(query(PREFIX)), 401, "UNAUTHORIZED", "인증이 필요합니다.");
        error(mvc.perform(query(PREFIX).header("Authorization", "Bearer invalid")), 401, "INVALID_TOKEN", "유효하지 않은 토큰입니다.");
        error(mvc.perform(query(PREFIX).header("Authorization", token(user(Long.MAX_VALUE, "missing@example.com")))),
                401, "UNAUTHORIZED", "인증이 필요합니다.");
        verifyNoInteractions(images);
        verify(locations, never()).findByTitleContainingOrderByIdAsc(anyString(), any());
        assertThat(snapshot()).isEqualTo(before);
    }
}
