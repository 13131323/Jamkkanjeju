package com.jamkkanjeju.server.domain.treasurehunt.integration;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.home.entity.*;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.service.NextLocationRecommender;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.treasurehunt.entity.*;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;

/** 임시 MySQL과 실제 JWT·HTTP로 중단의 기록 유지·미지급·격리·재시작·롤백을 검증한다. */
@SpringBootTest(properties = {"app.dev-auth.enabled=false", "logging.level.org.hibernate.SQL=warn"})
@AutoConfigureMockMvc
@Import(StopTreasureMissionApiIntegrationTest.FixedTime.class)
@Transactional
class StopTreasureMissionApiIntegrationTest extends MySqlIntegrationTestSupport {
    static final String URL = "/api/v2/treasure-missions/{id}/progress/stop";
    static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-16T03:00:00Z"), ZoneId.of("Asia/Seoul"));
    static final LocalDateTime NOW = LocalDateTime.now(CLOCK);
    static final AtomicLong SEQUENCE = new AtomicLong(9_200_000_000L);
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired TransactionTemplate transactions;
    @Autowired JwtTokenProvider tokens;
    @MockitoBean TourApiClient images;
    @MockitoSpyBean NextLocationRecommender recommender;

    /** 서비스와 실제 JWT 검증의 시각을 고정한다. */
    @TestConfiguration(proxyBeanMethods = false)
    static class FixedTime {
        @Bean @Primary Clock treasureStopTestClock() { return CLOCK; }
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void 일부발견과_미발견_모두_실제개수로_중단하고_기록과_보상을_유지한다(boolean partial) throws Exception {
        Data d = data(partial ? 4 : 5);
        if (partial) {
            discover(d, 4);
            discover(d, 2);
        }
        reload();
        var itemBefore = itemRows(d);
        var rewardBefore = rewardRows(d);
        var result = stop(d).andExpect(status().isOk())
                .andExpect(jsonPath("$.missionProgressStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.treasureCount").value(partial ? 4 : 5))
                .andExpect(jsonPath("$.reward").doesNotExist())
                .andExpect(jsonPath("$.nextLocation.id").value(d.location().getId()))
                .andExpect(jsonPath("$.nextLocation.distanceMeter").value(0))
                .andExpect(jsonPath("$.nextLocation.locationImageUrl").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.nextLocation.mission").value(org.hamcrest.Matchers.nullValue()));
        if (partial) {
            result.andExpect(jsonPath("$.foundTreasureIndexes").value(org.hamcrest.Matchers.contains(2, 4)));
        } else {
            result.andExpect(jsonPath("$.foundTreasureIndexes").isEmpty());
        }
        reload();
        assertThat(progress(d).getMissionStatus()).isEqualTo(MissionProgressStatus.COMPLETED);
        assertThat(progress(d).getCompletedAt()).isEqualTo(NOW);
        assertThat(progress(d).getFoundItemCount()).isEqualTo(partial ? 2 : 0);
        assertThat(itemRows(d)).isEqualTo(itemBefore);
        assertThat(rewardRows(d)).isEqualTo(rewardBefore);
        if (!partial) assertThat(jdbc.queryForObject("select count(*) from mission_reward_status where user_id=?",
                Long.class, d.user().getId())).isZero();
    }

    @Test
    void 현재장소도_추천하고_활성연결미션과_이미지를_반환한다() throws Exception {
        Data d = data(4);
        ReflectionTestUtils.setField(d.mission(), "location", d.location());
        var inactive = TreasureMission.builder().mission(common()).location(d.location())
                .status(MissionActivationStatus.INACTIVE).itemTotalCount(3).build();
        em.persist(inactive);
        when(images.getLocationImageUrl(d.location().getContentId())).thenReturn("image.png");
        reload();
        stop(d).andExpect(status().isOk())
                .andExpect(jsonPath("$.nextLocation.id").value(d.location().getId()))
                .andExpect(jsonPath("$.nextLocation.locationTitle").value("추천 장소"))
                .andExpect(jsonPath("$.nextLocation.locationImageUrl").value("image.png"))
                .andExpect(jsonPath("$.nextLocation.mission.id").value(d.mission().getMissionId()))
                .andExpect(jsonPath("$.nextLocation.mission.missionType").value("TREASURE"));
    }

    @Test
    void 반복중단은_거절하고_재시작은_동일ID로_새보물을_만들되_보상이력을_유지한다() throws Exception {
        Data d = data(4);
        discover(d, 4);
        reload();
        var rewardBefore = rewardRows(d);
        stop(d).andExpect(status().isOk());
        reload();
        var completed = snapshot(d);
        error(stop(d), 404, "TREASURE_MISSION_PROGRESS_NOT_FOUND", "보물찾기 미션 진행도를 찾을 수 없습니다.");
        reload();
        assertThat(snapshot(d)).isEqualTo(completed);
        mvc.perform(post("/api/v2/treasure-missions/{id}/progress", d.mission().getMissionId())
                        .header("Authorization", bearer(d.user())).param("latitude", "10").param("longitude", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.treasureMissionProgressId").value(d.progress().getId()))
                .andExpect(jsonPath("$.treasureCount").value(3))
                .andExpect(jsonPath("$.treasureItems[*].isFound").value(org.hamcrest.Matchers.contains(false, false, false)));
        reload();
        assertThat(progress(d).getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        assertThat(progress(d).getCompletedAt()).isNull();
        assertThat(progress(d).getFoundItemCount()).isZero();
        assertThat(itemRows(d)).hasSize(3);
        assertThat(rewardRows(d)).isEqualTo(rewardBefore);
    }

    @Test
    void 타인과_없는진행도는_거절하고_다른사용자와_미션을_변경하지_않는다() throws Exception {
        Data a = data(4);
        Data b = data(4);
        var another = TreasureMissionProgress.builder().user(a.user()).treasureMission(b.mission()).build();
        em.persist(another); em.flush();
        em.persist(TreasureMissionProgressItem.builder().treasureMissionProgress(another).itemIndex(1)
                .latitude(30).longitude(120).build());
        reload();
        var beforeA = snapshot(a);
        var beforeB = snapshot(b);
        var anotherBefore = jdbc.queryForMap("select * from treasure_mission_progress where id=?", another.getId());
        var anotherItems = jdbc.queryForList("select * from treasure_mission_progress_item where treasure_mission_progress_id=?", another.getId());
        error(mvc.perform(request(b.user(), a.progress().getId(), "10", "10")),
                404, "TREASURE_MISSION_PROGRESS_NOT_FOUND", "보물찾기 미션 진행도를 찾을 수 없습니다.");
        error(mvc.perform(request(a.user(), Long.MAX_VALUE, "10", "10")),
                404, "TREASURE_MISSION_PROGRESS_NOT_FOUND", "보물찾기 미션 진행도를 찾을 수 없습니다.");
        reload();
        assertThat(snapshot(a)).isEqualTo(beforeA);
        stop(a).andExpect(status().isOk());
        reload();
        assertThat(snapshot(b)).isEqualTo(beforeB);
        assertThat(jdbc.queryForMap("select * from treasure_mission_progress where id=?", another.getId())).isEqualTo(anotherBefore);
        assertThat(jdbc.queryForList("select * from treasure_mission_progress_item where treasure_mission_progress_id=?", another.getId())).isEqualTo(anotherItems);
    }

    @Test
    void 비활성미션은_중단하지_않고_데이터를_유지한다() throws Exception {
        Data d = data(4);
        d.mission().changeStatus(MissionActivationStatus.INACTIVE);
        reload();
        var before = snapshot(d);
        error(stop(d), 404, "TREASURE_MISSION_INACTIVE", "비활성화된 보물찾기 미션입니다.");
        reload();
        assertThat(snapshot(d)).isEqualTo(before);
    }

    @Test
    void Path와_Query_오류는_400이고_기존데이터를_유지한다() throws Exception {
        Data d = data(4);
        reload();
        var before = snapshot(d);
        error(mvc.perform(request(d.user(), "abc", "10", "10")), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        for (String[] values : List.of(new String[]{null, "10"}, new String[]{"10", null},
                new String[]{"abc", "10"}, new String[]{"10", "abc"}, new String[]{"-90.01", "0"},
                new String[]{"90.01", "0"}, new String[]{"0", "-180.01"}, new String[]{"0", "180.01"})) {
            error(mvc.perform(request(d.user(), d.progress().getId(), values[0], values[1])),
                    400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        reload();
        assertThat(snapshot(d)).isEqualTo(before);
    }

    @Test
    void 토큰없음과_DB사용자없음은_401이고_기존데이터를_유지한다() throws Exception {
        Data d = data(4);
        reload();
        var before = snapshot(d);
        error(mvc.perform(patch(URL, d.progress().getId()).param("latitude", "10").param("longitude", "10")),
                401, "UNAUTHORIZED", "인증이 필요합니다.");
        var absent = User.builder().email("absent@example.com").passwordHash("hash").build();
        ReflectionTestUtils.setField(absent, "id", Long.MAX_VALUE);
        error(mvc.perform(request(absent, d.progress().getId(), "10", "10")), 401, "UNAUTHORIZED", "인증이 필요합니다.");
        reload();
        assertThat(snapshot(d)).isEqualTo(before);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void 완료변경을_flush한뒤_추천이_없으면_전체를_롤백한다() throws Exception {
        Data d = transactions.execute(transaction -> data(4));
        try {
            discover(d, 2);
            var before = snapshot(d);
            doAnswer(invocation -> {
                em.flush();
                assertThat(jdbc.queryForObject("select mission_status from treasure_mission_progress where id=?",
                        String.class, d.progress().getId())).isEqualTo("COMPLETED");
                return Optional.empty();
            }).when(recommender).recommend(10, 10);
            var result = error(stop(d), 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
            assertThat(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8))
                    .doesNotContain("추천 가능한 장소가 없습니다.", "userId=", "progressId=");
            assertThat(snapshot(d)).isEqualTo(before);
        } finally {
            reset(recommender);
            clean(d);
        }
    }

    /** nullable 미션 장소와 미지급 AR·포인트·쿠폰, 실제 개수가 설정과 다른 진행도를 만든다. */
    private Data data(int count) {
        long sequence = SEQUENCE.incrementAndGet();
        var user = User.builder().email("stop-treasure-" + sequence + "@example.com").passwordHash("test").point(10).build();
        em.persist(user);
        var location = Location.builder().contentId(sequence).title("추천 장소").address("주소").category("관광지")
                .radius(50).latitude(10).longitude(10).build();
        em.persist(location);
        var character = ArCharacter.builder().name("테스트 캐릭터").description("설명").storyTitle("이야기")
                .acquireCondition("미션").imgUrl("character.png").representativeColor("blue").hashtags(List.of()).build();
        em.persist(character);
        var coupon = Coupon.builder().location(location).couponPrice(3000).build();
        em.persist(coupon);
        var mission = TreasureMission.builder().mission(common()).status(MissionActivationStatus.ACTIVE)
                .itemTotalCount(8).arCharacter(character).point(100).coupon(coupon).build();
        em.persist(mission); em.flush();
        var progress = TreasureMissionProgress.builder().user(user).treasureMission(mission).build();
        em.persist(progress); em.flush();
        for (int index = count; index >= 1; index--) {
            em.persist(TreasureMissionProgressItem.builder().treasureMissionProgress(progress).itemIndex(index)
                    .latitude(33.3 + index * .001).longitude(126.3 + index * .001).build());
        }
        em.flush();
        return new Data(user, mission, progress, location, character, coupon);
    }

    /** 기존 유형 코드로 공통 미션을 생성한다. */
    private Mission common() {
        var type = em.createQuery("select t from MissionType t where t.type=:type", MissionType.class)
                .setParameter("type", MissionTypeCode.TREASURE).getSingleResult();
        var mission = Mission.builder().missionType(type).build();
        em.persist(mission);
        return mission;
    }

    /** 실제 저장 API로 발견·획득·공통 지급 이력이 있는 준비 상태를 만든다. */
    private void discover(Data d, int index) throws Exception {
        mvc.perform(patch("/api/v2/treasure-missions/{id}/progress", d.progress().getId())
                        .header("Authorization", bearer(d.user())).param("latitude", "10").param("longitude", "10")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"treasureIndex\":" + index + "}"))
                .andExpect(status().isOk());
    }

    /** 본문 없이 좌표 Query만 포함한 인증 요청을 구성한다. */
    private MockHttpServletRequestBuilder request(User user, Object id, String lat, String lng) {
        var request = patch(URL, id).header("Authorization", bearer(user));
        if (lat != null) request.param("latitude", lat);
        if (lng != null) request.param("longitude", lng);
        return request;
    }

    /** 고정 좌표로 본인의 진행도를 중단한다. */
    private ResultActions stop(Data d) throws Exception {
        return mvc.perform(request(d.user(), d.progress().getId(), "10", "10"));
    }

    /** 실제 액세스 토큰을 발급한다. */
    private String bearer(User user) { return "Bearer " + tokens.createAccessToken(user).value(); }

    /** 오류의 HTTP 상태와 공개 본문을 함께 검증한다. */
    private ResultActions error(ResultActions result, int statusCode, String code, String message) throws Exception {
        return result.andExpect(status().is(statusCode)).andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.message").value(message));
    }

    /** 영속성 컨텍스트를 비워 실제 DB에서 다시 읽는다. */
    private void reload() { em.flush(); em.clear(); }

    /** 이번 진행도를 ID로 재조회한다. */
    private TreasureMissionProgress progress(Data d) { return em.find(TreasureMissionProgress.class, d.progress().getId()); }

    /** 발견 상태·시각·번호·좌표와 감사 시각까지 비교한다. */
    private List<Map<String, Object>> itemRows(Data d) {
        return jdbc.queryForList("select * from treasure_mission_progress_item where treasure_mission_progress_id=? order by item_index", d.progress().getId());
    }

    /** 중단 전후의 포인트·획득 기록·공통 지급 상태 전체를 비교한다. */
    private List<Object> rewardRows(Data d) {
        return List.of(jdbc.queryForObject("select point from user where id=?", Integer.class, d.user().getId()),
                jdbc.queryForList("select * from acquired_ar_character where user_id=?", d.user().getId()),
                jdbc.queryForList("select * from acquired_coupon where user_id=?", d.user().getId()),
                jdbc.queryForList("select * from mission_reward_status where user_id=? order by mission_id", d.user().getId()));
    }

    /** 거절·롤백 전후의 전체 상태를 실제 DB 행으로 비교한다. */
    private List<Object> snapshot(Data d) {
        return List.of(jdbc.queryForMap("select * from treasure_mission_progress where id=?", d.progress().getId()),
                itemRows(d), rewardRows(d));
    }

    /** 실제 롤백 검증을 위해 커밋한 이번 데이터만 FK 순서대로 정리한다. */
    private void clean(Data d) {
        jdbc.update("delete from acquired_ar_character where user_id=?", d.user().getId());
        jdbc.update("delete from acquired_coupon where user_id=?", d.user().getId());
        jdbc.update("delete from mission_reward_status where user_id=?", d.user().getId());
        jdbc.update("delete from treasure_mission_progress_item where treasure_mission_progress_id=?", d.progress().getId());
        jdbc.update("delete from treasure_mission_progress where id=?", d.progress().getId());
        jdbc.update("delete from treasure_mission where mission_id=?", d.mission().getMissionId());
        jdbc.update("delete from mission where id=?", d.mission().getMissionId());
        jdbc.update("delete from coupon where id=?", d.coupon().getId());
        jdbc.update("delete from ar_character where id=?", d.character().getId());
        jdbc.update("delete from location where id=?", d.location().getId());
        jdbc.update("delete from user where id=?", d.user().getId());
    }

    /** 이번 테스트가 소유하는 엔티티이다. */
    private record Data(User user, TreasureMission mission, TreasureMissionProgress progress,
                        Location location, ArCharacter character, Coupon coupon) {
    }
}
