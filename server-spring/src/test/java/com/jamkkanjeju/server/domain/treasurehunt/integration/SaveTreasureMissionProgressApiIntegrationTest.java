package com.jamkkanjeju.server.domain.treasurehunt.integration;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.domain.auth.config.JwtProperties;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.home.entity.*;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.service.NextLocationRecommender;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.treasurehunt.entity.*;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import javax.crypto.SecretKey;
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

/** 임시 MySQL과 실제 JWT·HTTP로 보물별 보상, 재도전, 오류·격리와 실제 롤백을 검증한다. */
@SpringBootTest(properties = {"app.dev-auth.enabled=false", "logging.level.org.hibernate.SQL=warn"})
@AutoConfigureMockMvc
@Import(SaveTreasureMissionProgressApiIntegrationTest.FixedTime.class)
@Transactional
class SaveTreasureMissionProgressApiIntegrationTest extends MySqlIntegrationTestSupport {
    static final String URL = "/api/v2/treasure-missions/{id}/progress";
    static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-16T03:00:00Z"), ZoneId.of("Asia/Seoul"));
    static final LocalDateTime NOW = LocalDateTime.now(CLOCK);
    static final AtomicLong SEQUENCE = new AtomicLong(9_100_000_000L);
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired TransactionTemplate transactions;
    @Autowired JwtTokenProvider tokens;
    @Autowired SecretKey jwtSigningKey;
    @Autowired JwtProperties jwtProperties;
    @MockitoBean TourApiClient images;
    @MockitoSpyBean NextLocationRecommender recommender;
    @MockitoSpyBean MissionRewardStatusRepository rewardStatuses;

    /** 서비스와 JWT 검증에 같은 고정 시각을 주입한다. */
    @TestConfiguration(proxyBeanMethods = false)
    static class FixedTime {
        @Bean @Primary Clock treasureSaveTestClock() { return CLOCK; }
    }

    @Test
    void 임의순서_발견마다_AR_포인트_쿠폰을_한종류씩_지급하고_완료한다() throws Exception {
        Data d = data(3, 1);
        reload();
        var coordinates = coordinateRows(d);
        save(d, 2).andExpect(status().isOk())
                .andExpect(jsonPath("$.missionProgressStatus").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.foundTreasureIndexes").value(org.hamcrest.Matchers.contains(2)))
                .andExpect(jsonPath("$.reward.arCharacter.id").value(d.character().getId()))
                .andExpect(jsonPath("$.reward.point").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.reward.coupon").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.nextLocation").value(org.hamcrest.Matchers.nullValue()));
        reload();
        assertThat(progress(d).getFoundItemCount()).isEqualTo(1);
        assertThat(item(d, 2).getFoundAt()).isEqualTo(NOW);
        assertThat(item(d, 1).getFoundAt()).isNull();
        assertThat(acquired("acquired_ar_character", d)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select mission_id from acquired_ar_character where user_id=?", Long.class, d.user().getId()))
                .isEqualTo(d.mission().getMissionId());
        assertThat(rewardStatus(d).isArCharacterRewardGranted()).isTrue();
        assertThat(rewardStatus(d).isPointRewardGranted()).isFalse();
        verifyNoInteractions(images);
        verify(recommender, never()).recommend(anyDouble(), anyDouble());

        save(d, 1).andExpect(status().isOk()).andExpect(jsonPath("$.reward.point").value(100))
                .andExpect(jsonPath("$.reward.arCharacter").value(org.hamcrest.Matchers.nullValue()));
        reload();
        assertThat(em.find(User.class, d.user().getId()).getPoint()).isEqualTo(110);
        assertThat(rewardStatus(d).isPointRewardGranted()).isTrue();
        when(images.getLocationImageUrl(d.location().getContentId())).thenReturn("image.png");
        Map<String, Object> response = body(save(d, 3).andExpect(status().isOk())
                .andExpect(jsonPath("$.missionProgressStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.foundTreasureIndexes").value(org.hamcrest.Matchers.contains(1, 2, 3)))
                .andExpect(jsonPath("$.nextLocation.id").value(d.location().getId()))
                .andExpect(jsonPath("$.nextLocation.distanceMeter").value(0))
                .andExpect(jsonPath("$.nextLocation.locationImageUrl").value("image.png"))
                .andExpect(jsonPath("$.nextLocation.mission").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.reward.coupon.couponPrice").value(3000)));
        assertThat(response).containsOnlyKeys("missionProgressStatus", "treasureCount", "foundTreasureIndexes", "nextLocation", "reward");
        reload();
        assertThat(progress(d).getCompletedAt()).isEqualTo(NOW);
        assertThat(progress(d).getFoundItemCount()).isEqualTo(3);
        assertThat(item(d, 3).getFoundAt()).isEqualTo(NOW);
        assertThat(acquired("acquired_coupon", d)).isEqualTo(1);
        assertThat(rewardStatus(d).isCouponRewardGranted()).isTrue();
        assertThat(coordinateRows(d)).isEqualTo(coordinates);
        assertThat(jdbc.queryForObject("select item_total_count from treasure_mission where mission_id=?", Integer.class, d.mission().getMissionId())).isEqualTo(8);
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 4, 5})
    void 실제아이템_전체수까지_찾아야_완료하고_이미지없음도_허용한다(int count) throws Exception {
        Data d = data(count, 0);
        reload();
        for (int index = count; index >= 1; index--) {
            save(d, index).andExpect(status().isOk()).andExpect(jsonPath("$.treasureCount").value(count))
                    .andExpect(jsonPath("$.missionProgressStatus").value(index == 1 ? "COMPLETED" : "IN_PROGRESS"));
        }
        reload();
        assertThat(progress(d).getFoundItemCount()).isEqualTo(count);
        assertThat(progress(d).getCompletedAt()).isEqualTo(NOW);
        assertThat(acquired("acquired_ar_character", d)).isZero();
        assertThat(acquired("acquired_coupon", d)).isZero();
        assertThat(rewardStatus(d)).isNull();
    }

    @Test
    void 완료후_같은ID로_재시작해도_보상이력은_유지되고_다시지급하지_않는다() throws Exception {
        Data d = data(3, 1);
        reload();
        for (int index = 1; index <= 3; index++) save(d, index).andExpect(status().isOk());
        reload();
        var before = rewardSnapshot(d);
        mvc.perform(post("/api/v2/treasure-missions/{id}/progress", d.mission().getMissionId())
                        .header("Authorization", bearer(d.user())).param("latitude", "10").param("longitude", "10"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.treasureMissionProgressId").value(d.progress().getId()))
                .andExpect(jsonPath("$.treasureItems[*].isFound").value(org.hamcrest.Matchers.contains(false, false, false)));
        reload();
        assertThat(progress(d).getFoundItemCount()).isZero();
        assertThat(progress(d).getCompletedAt()).isNull();
        for (int index = 1; index <= 3; index++) {
            save(d, index).andExpect(status().isOk()).andExpect(jsonPath("$.reward").value(
                    org.hamcrest.Matchers.allOf(org.hamcrest.Matchers.hasEntry("arCharacter", null),
                            org.hamcrest.Matchers.hasEntry("point", null), org.hamcrest.Matchers.hasEntry("coupon", null))));
        }
        reload();
        assertThat(rewardSnapshot(d)).isEqualTo(before);
    }

    @Test
    void 기지급_AR을_건너뛰어_포인트부터_지급하고_보유쿠폰은_중복저장하지_않는다() throws Exception {
        Data d = data(3, 1);
        var rewardStatus = MissionRewardStatus.builder().mission(d.mission().getMission()).user(d.user()).build();
        rewardStatus.grantArCharacterReward();
        em.persist(rewardStatus);
        em.persist(AcquiredCoupon.builder().user(d.user()).coupon(d.coupon()).acquiredAt(NOW.minusDays(1)).build());
        reload();
        save(d, 1).andExpect(status().isOk()).andExpect(jsonPath("$.reward.point").value(100));
        save(d, 2).andExpect(status().isOk()).andExpect(jsonPath("$.reward.coupon.couponPrice").value(3000));
        save(d, 3).andExpect(status().isOk()).andExpect(jsonPath("$.reward.point").value(org.hamcrest.Matchers.nullValue()));
        reload();
        assertThat(acquired("acquired_coupon", d)).isEqualTo(1);
        assertThat(acquired("acquired_ar_character", d)).isZero();
        assertThat(rewardStatus(d).isArCharacterRewardGranted()).isTrue();
        assertThat(rewardStatus(d).isCouponRewardGranted()).isTrue();
    }

    @Test
    void 장소없는쿠폰과_현재장소_활성다음미션을_반환한다() throws Exception {
        Data d = data(1, 3);
        ReflectionTestUtils.setField(d.coupon(), "location", null);
        ReflectionTestUtils.setField(d.mission(), "location", d.location());
        TreasureMission inactive = TreasureMission.builder().mission(common()).location(d.location())
                .status(MissionActivationStatus.INACTIVE).itemTotalCount(3).build();
        em.persist(inactive);
        reload();
        save(d, 1).andExpect(status().isOk())
                .andExpect(jsonPath("$.nextLocation.id").value(d.location().getId()))
                .andExpect(jsonPath("$.nextLocation.locationImageUrl").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.nextLocation.mission.id").value(d.mission().getMissionId()))
                .andExpect(jsonPath("$.nextLocation.mission.missionType").value("TREASURE"))
                .andExpect(jsonPath("$.reward.coupon.couponLocation").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void 같은보물_재요청과_완료후_재요청은_상태와_보상을_변경하지_않는다() throws Exception {
        Data d = data(3, 1);
        reload();
        save(d, 2).andExpect(status().isOk());
        reload();
        var before = snapshot(d);
        error(save(d, 2), 409, "TREASURE_ITEM_ALREADY_FOUND", "이미 찾은 보물입니다.");
        reload();
        assertThat(snapshot(d)).isEqualTo(before);
        save(d, 1).andExpect(status().isOk());
        save(d, 3).andExpect(status().isOk());
        reload();
        var completed = snapshot(d);
        error(save(d, 3), 404, "TREASURE_MISSION_PROGRESS_NOT_FOUND", "보물찾기 미션 진행도를 찾을 수 없습니다.");
        reload();
        assertThat(snapshot(d)).isEqualTo(completed);
    }

    @Test
    void 타인_없는진행도와_없는보물은_거절하고_다른진행도의_같은번호는_변경하지_않는다() throws Exception {
        Data a = data(3, 1);
        Data b = data(3, 1);
        // 같은 사용자의 다른 미션도 별도 진행도로 준비한다.
        var another = TreasureMissionProgress.builder().user(a.user()).treasureMission(b.mission()).build();
        em.persist(another); em.flush();
        em.persist(TreasureMissionProgressItem.builder().treasureMissionProgress(another).itemIndex(1).latitude(30).longitude(120).build());
        reload();
        var otherBefore = snapshot(b);
        error(mvc.perform(request(b.user(), a.progress().getId(), "10", "10", "{\"treasureIndex\":1}")),
                404, "TREASURE_MISSION_PROGRESS_NOT_FOUND", "보물찾기 미션 진행도를 찾을 수 없습니다.");
        error(mvc.perform(request(a.user(), Long.MAX_VALUE, "10", "10", "{\"treasureIndex\":1}")),
                404, "TREASURE_MISSION_PROGRESS_NOT_FOUND", "보물찾기 미션 진행도를 찾을 수 없습니다.");
        error(save(a, 99), 404, "TREASURE_ITEM_NOT_FOUND", "보물찾기 아이템을 찾을 수 없습니다.");
        save(a, 1).andExpect(status().isOk());
        reload();
        assertThat(snapshot(b)).isEqualTo(otherBefore);
        assertThat(em.find(TreasureMissionProgressItem.class, new TreasureMissionProgressItemId(another.getId(), 1)).getItemStatus()).isEqualTo(TreasureItemStatus.UNFOUND);
    }

    @Test
    void 비활성미션은_발견과_보상을_반영하지_않는다() throws Exception {
        Data d = data(3, 1);
        d.mission().changeStatus(MissionActivationStatus.INACTIVE);
        reload();
        var before = snapshot(d);
        error(save(d, 1), 404, "TREASURE_MISSION_INACTIVE", "비활성화된 보물찾기 미션입니다.");
        reload();
        assertThat(snapshot(d)).isEqualTo(before);
    }

    @Test
    void Body_Path_Query_오류는_400이고_기존데이터를_유지한다() throws Exception {
        Data d = data(3, 1);
        reload();
        var before = snapshot(d);
        for (String body : List.of("", "{}", "null", "{", "{\"treasureIndex\":null}", "{\"treasureIndex\":\"abc\"}")) {
            error(mvc.perform(request(d.user(), d.progress().getId(), "10", "10", body)), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        error(mvc.perform(request(d.user(), "abc", "10", "10", "{\"treasureIndex\":1}")), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        for (String[] values : List.of(new String[]{null, "10"}, new String[]{"10", null},
                new String[]{"abc", "10"}, new String[]{"10", "abc"}, new String[]{"-90.01", "0"},
                new String[]{"90.01", "0"}, new String[]{"0", "-180.01"}, new String[]{"0", "180.01"})) {
            error(mvc.perform(request(d.user(), d.progress().getId(), values[0], values[1], "{\"treasureIndex\":1}")),
                    400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        reload();
        assertThat(snapshot(d)).isEqualTo(before);
    }

    @Test
    void 인증오류와_DB사용자없음은_401이고_변경하지_않는다() throws Exception {
        Data d = data(3, 1);
        reload();
        var before = snapshot(d);
        String valid = tokens.createAccessToken(d.user()).value();
        String expired = new JwtTokenProvider(jwtSigningKey, jwtProperties, Clock.offset(CLOCK, Duration.ofHours(-1)))
                .createAccessToken(d.user()).value();
        for (String[] values : List.of(new String[]{null, "UNAUTHORIZED", "인증이 필요합니다."},
                new String[]{valid + "x", "INVALID_TOKEN", "유효하지 않은 토큰입니다."},
                new String[]{expired, "EXPIRED_TOKEN", "만료된 토큰입니다."},
                new String[]{tokens.createRefreshToken(d.user()).value(), "INVALID_TOKEN", "유효하지 않은 토큰입니다."})) {
            var request = patch(URL, d.progress().getId()).param("latitude", "10").param("longitude", "10")
                    .contentType(MediaType.APPLICATION_JSON).content("{\"treasureIndex\":1}");
            if (values[0] != null) request.header("Authorization", "Bearer " + values[0]);
            error(mvc.perform(request), 401, values[1], values[2]);
        }
        User absent = User.builder().email("absent@example.com").passwordHash("hash").build();
        ReflectionTestUtils.setField(absent, "id", Long.MAX_VALUE);
        error(mvc.perform(request(absent, d.progress().getId(), "10", "10", "{\"treasureIndex\":1}")),
                401, "UNAUTHORIZED", "인증이 필요합니다.");
        reload();
        assertThat(snapshot(d)).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void 보상저장후_실패와_마지막발견_추천실패는_전체를_롤백한다(boolean recommendationFailure) throws Exception {
        Data d = transactions.execute(transaction -> data(recommendationFailure ? 1 : 3, 2));
        try {
            var before = snapshot(d);
            if (recommendationFailure) {
                doReturn(Optional.empty()).when(recommender).recommend(10, 10);
            } else {
                doAnswer(invocation -> {
                    em.persist(invocation.getArgument(0));
                    em.flush();
                    throw new IllegalStateException("내부 비밀 메시지");
                }).when(rewardStatuses).save(any());
            }
            var result = error(save(d, 1), 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
            assertThat(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8))
                    .doesNotContain("내부 비밀 메시지", "추천 가능한 장소가 없습니다.");
            assertThat(snapshot(d)).isEqualTo(before);
        } finally {
            reset(rewardStatuses, recommender);
            clean(d);
        }
    }

    /** 사용자·미션·실제 아이템 수·보상 종류를 고정 데이터로 준비한다. */
    private Data data(int count, int mode) {
        long sequence = SEQUENCE.incrementAndGet();
        User user = User.builder().email("save-treasure-" + sequence + "@example.com").passwordHash("test").point(10).build();
        em.persist(user);
        Location location = Location.builder().contentId(sequence).title("추천 장소").address("주소").category("관광지")
                .radius(50).latitude(10).longitude(10).build();
        em.persist(location);
        ArCharacter character = ArCharacter.builder().requiredFragmentCount(10).name("테스트 캐릭터").description("설명").storyTitle("이야기")
                .acquireCondition("미션").imgUrl("character.png").representativeColor("blue").hashtags(List.of()).build();
        em.persist(character);
        Coupon coupon = Coupon.builder().location(location).couponPrice(3000).build();
        em.persist(coupon);
        TreasureMission mission = TreasureMission.builder().mission(common()).status(MissionActivationStatus.ACTIVE)
                .itemTotalCount(8).arCharacter(mode == 1 ? character : null)
                .point(mode == 1 || mode == 2 ? 100 : null).coupon(mode == 1 || mode == 3 ? coupon : null).build();
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

    /** 유형 ID 대신 유형 코드로 공통 미션을 저장한다. */
    private Mission common() {
        var type = em.createQuery("select t from MissionType t where t.type=:type", MissionType.class)
                .setParameter("type", MissionTypeCode.TREASURE).getSingleResult();
        var mission = Mission.builder().missionType(type).build(); em.persist(mission); return mission;
    }

    /** 인증된 HTTP 저장 요청을 만든다. */
    private MockHttpServletRequestBuilder request(User user, Object id, String lat, String lng, String body) {
        var request = patch(URL, id).header("Authorization", bearer(user)).contentType(MediaType.APPLICATION_JSON).content(body);
        if (lat != null) request.param("latitude", lat);
        if (lng != null) request.param("longitude", lng);
        return request;
    }

    /** 사용자 요청 위치는 보물에서 멀리 떨어져 있어도 발견 판정에 사용되지 않는다. */
    private ResultActions save(Data d, int index) throws Exception {
        return mvc.perform(request(d.user(), d.progress().getId(), "10", "10", "{\"treasureIndex\":" + index + "}"));
    }

    /** 실제 액세스 토큰을 발급한다. */
    private String bearer(User user) { return "Bearer " + tokens.createAccessToken(user).value(); }

    /** 응답 JSON을 Map으로 읽는다. */
    private Map<String, Object> body(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), "$");
    }

    /** 오류 상태·code·message를 함께 확인한다. */
    private ResultActions error(ResultActions result, int code, String name, String message) throws Exception {
        return result.andExpect(status().is(code)).andExpect(jsonPath("$.code").value(name)).andExpect(jsonPath("$.message").value(message));
    }

    /** 영속성 컨텍스트를 비워 실제 저장 결과를 읽는다. */
    private void reload() { em.flush(); em.clear(); }

    /** 준비한 진행도·아이템·공통 지급 상태를 ID로 재조회한다. */
    private TreasureMissionProgress progress(Data d) { return em.find(TreasureMissionProgress.class, d.progress().getId()); }
    private TreasureMissionProgressItem item(Data d, int index) { return em.find(TreasureMissionProgressItem.class, new TreasureMissionProgressItemId(d.progress().getId(), index)); }
    private MissionRewardStatus rewardStatus(Data d) { return em.find(MissionRewardStatus.class, new MissionRewardStatusId(d.mission().getMissionId(), d.user().getId())); }

    /** 이번 사용자에게 지급된 실제 획득 행 수이다. */
    private long acquired(String table, Data d) {
        return jdbc.queryForObject("select count(*) from " + table + " where user_id=?", Long.class, d.user().getId());
    }

    /** 좌표가 변경되지 않았는지 비교할 목록이다. */
    private List<Map<String, Object>> coordinateRows(Data d) {
        return jdbc.queryForList("select item_index, latitude, longitude from treasure_mission_progress_item where treasure_mission_progress_id=? order by item_index", d.progress().getId());
    }

    /** 포인트·획득·지급 상태의 의미 있는 값만 비교해 감사 시각 갱신과 구분한다. */
    private List<Object> rewardSnapshot(Data d) {
        return List.of(jdbc.queryForObject("select point from user where id=?", Integer.class, d.user().getId()),
                jdbc.queryForList("select * from acquired_ar_character where user_id=?", d.user().getId()),
                jdbc.queryForList("select * from acquired_coupon where user_id=?", d.user().getId()),
                jdbc.queryForList("select ar_character_reward_granted, point_reward_granted, coupon_reward_granted from mission_reward_status where user_id=? order by mission_id", d.user().getId()));
    }

    /** 오류·롤백 전후의 전체 진행도·아이템·보상 데이터를 실제 DB에서 비교한다. */
    private List<Object> snapshot(Data d) {
        return List.of(jdbc.queryForMap("select * from treasure_mission_progress where id=?", d.progress().getId()),
                jdbc.queryForList("select * from treasure_mission_progress_item where treasure_mission_progress_id=? order by item_index", d.progress().getId()), rewardSnapshot(d));
    }

    /** 별도 커밋한 이번 테스트 데이터만 FK 순서대로 정리한다. */
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

    /** 테스트가 소유하는 엔티티와 식별자이다. */
    private record Data(User user, TreasureMission mission, TreasureMissionProgress progress,
                        Location location, ArCharacter character, Coupon coupon) {
    }
}
