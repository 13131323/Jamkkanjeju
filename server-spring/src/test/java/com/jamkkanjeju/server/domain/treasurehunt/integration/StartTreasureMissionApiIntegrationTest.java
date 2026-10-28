package com.jamkkanjeju.server.domain.treasurehunt.integration;

import static com.jamkkanjeju.server.domain.treasurehunt.support.TreasureMissionFixtures.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.domain.auth.config.JwtProperties;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.treasurehunt.entity.*;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionProgressItemRepository;
import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** 임시 MySQL에서 JWT→HTTP→JPA, 상태 유지·교체와 실제 롤백을 검증한다. */
@SpringBootTest(properties = {"app.dev-auth.enabled=false", "logging.level.org.hibernate.SQL=warn"})
@AutoConfigureMockMvc
@Transactional
class StartTreasureMissionApiIntegrationTest extends MySqlIntegrationTestSupport {
    private static final String URL = "/api/v2/treasure-missions/{missionId}/progress";
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired TransactionTemplate transactions;
    @Autowired JwtTokenProvider tokens;
    @Autowired SecretKey jwtSigningKey;
    @Autowired JwtProperties jwtProperties;
    @MockitoBean TourApiClient tourApi;
    @MockitoSpyBean TreasureMissionProgressItemRepository items;

    @Test
    void 최초_시작과_반복은_201_200이며_같은_진행도와_보물_3개를_유지한다() throws Exception {
        User user = user("first");
        TreasureMission mission = mission(null);
        var rewardsBefore = rewardSnapshot(user.getId());
        Map<String, Object> first = body(start(user, mission.getMissionId(), 33.3, 126.3).andExpect(status().isCreated())
                .andExpect(jsonPath("$.missionProgressStatus").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.treasureCount").value(3)).andExpect(jsonPath("$.created").doesNotExist()));
        Map<String, Object> second = body(start(user, mission.getMissionId(), 35, 128).andExpect(status().isOk()));
        assertThat(second).isEqualTo(first);
        assertThat(first).containsOnlyKeys("treasureMissionProgressId", "missionProgressStatus", "location", "treasureCount", "treasureItems");
        assertThat(first).containsEntry("location", null);
        clear();
        TreasureMissionProgress progress = findProgress(user.getId(), mission.getMissionId());
        assertThat(progress.getFoundItemCount()).isZero();
        assertThat(progress.getCompletedAt()).isNull();
        assertThat(progress.getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        assertThat(progressRows(user.getId())).isEqualTo(1);
        assertThat(rewardSnapshot(user.getId())).isEqualTo(rewardsBefore);
        assertThat(em.find(TreasureMission.class, mission.getMissionId()).getItemTotalCount()).isEqualTo(8);
        var saved = items.findAllByIdTreasureMissionProgressIdOrderByIdItemIndexAsc(progress.getId());
        assertThat(saved).extracting(TreasureMissionProgressItem::getItemIndex).containsExactly(1, 2, 3);
        assertThat(saved).allSatisfy(item -> {
            assertThat(item.getItemStatus()).isEqualTo(TreasureItemStatus.UNFOUND);
            assertThat(item.getFoundAt()).isNull();
            assertThat(distance(33.3, 126.3, item.getLatitude(), item.getLongitude())).isLessThanOrEqualTo(100.001);
        });
        List<Map<String, Object>> details = JsonPath.parse(first).read("$.treasureItems");
        assertThat(details.getFirst()).containsOnlyKeys("treasureIndex", "location", "isFound");
        Map<String, Object> itemLocation = JsonPath.parse(first).read("$.treasureItems[0].location");
        assertThat(itemLocation).containsOnlyKeys("lat", "lng");
        verifyNoInteractions(tourApi);
    }

    @ParameterizedTest
    @ValueSource(ints = {4, 5})
    void 이어하기는_실제_개수와_정렬_발견여부_좌표_시각을_유지한다(int count) throws Exception {
        User user = user("resume");
        TreasureMission mission = mission(null);
        var progress = savedProgress(user, mission, count, false);
        clear();
        var before = snapshot(progress.getId());
        start(user, mission.getMissionId(), 40, 130).andExpect(status().isOk())
                .andExpect(jsonPath("$.treasureCount").value(count))
                .andExpect(jsonPath("$.treasureItems[0].treasureIndex").value(1))
                .andExpect(jsonPath("$.treasureItems[0].isFound").value(true))
                .andExpect(jsonPath("$.treasureItems[0].location.lat").value(org.hamcrest.Matchers.closeTo(33.301, 1e-10)));
        clear();
        assertThat(snapshot(progress.getId())).isEqualTo(before);
        assertThat(findProgress(user.getId(), mission.getMissionId()).getFoundItemCount()).isEqualTo(count);
    }

    @Test
    void 완료후_재시작은_같은ID에_3개를_교체하고_보상과_타인_다른미션은_유지한다() throws Exception {
        User user = user("restart");
        User other = user("other");
        TreasureMission mission = mission(null);
        TreasureMission otherMission = mission(null);
        var progress = savedProgress(user, mission, 5, true);
        var otherProgress = savedProgress(other, mission, 4, true);
        var anotherMissionProgress = savedProgress(user, otherMission, 4, true);
        var reward = MissionRewardStatus.builder().user(user).mission(mission.getMission()).build();
        reward.grantArCharacterReward(); reward.grantPointReward(); reward.grantCouponReward();
        em.persist(reward);
        clear();
        var otherBefore = snapshot(otherProgress.getId());
        var missionBefore = snapshot(anotherMissionProgress.getId());
        var rewardsBefore = rewardSnapshot(user.getId());
        Map<String, Object> first = body(start(user, mission.getMissionId(), 35, 128).andExpect(status().isOk())
                .andExpect(jsonPath("$.treasureMissionProgressId").value(progress.getId()))
                .andExpect(jsonPath("$.treasureCount").value(3)));
        clear();
        var reloaded = findProgress(user.getId(), mission.getMissionId());
        assertThat(reloaded.getFoundItemCount()).isZero();
        assertThat(reloaded.getCompletedAt()).isNull();
        assertThat(reloaded.getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        assertThat(items.findAllByIdTreasureMissionProgressIdOrderByIdItemIndexAsc(progress.getId())).hasSize(3)
                .allSatisfy(item -> {
                    assertThat(item.getItemStatus()).isEqualTo(TreasureItemStatus.UNFOUND);
                    assertThat(item.getFoundAt()).isNull();
                    assertThat(distance(35, 128, item.getLatitude(), item.getLongitude())).isLessThanOrEqualTo(100.001);
                });
        assertThat(body(start(user, mission.getMissionId(), 36, 129).andExpect(status().isOk()))).isEqualTo(first);
        clear();
        assertThat(snapshot(otherProgress.getId())).isEqualTo(otherBefore);
        assertThat(snapshot(anotherMissionProgress.getId())).isEqualTo(missionBefore);
        assertThat(rewardSnapshot(user.getId())).isEqualTo(rewardsBefore);
        var savedReward = em.find(MissionRewardStatus.class, new MissionRewardStatusId(mission.getMissionId(), user.getId()));
        assertThat(savedReward.isArCharacterRewardGranted()).isTrue();
        assertThat(savedReward.isPointRewardGranted()).isTrue();
        assertThat(savedReward.isCouponRewardGranted()).isTrue();
    }

    @Test
    void 다른사용자의_진행도가_있어도_현재사용자_진행도를_생성한다() throws Exception {
        User current = user("isolation");
        User other = user("owner");
        var mission = mission(null);
        var progress = savedProgress(other, mission, 4, true);
        clear();
        var before = snapshot(progress.getId());
        start(current, mission.getMissionId(), 33.3, 126.3).andExpect(status().isCreated());
        clear();
        assertThat(findProgress(current.getId(), mission.getMissionId()).getId()).isNotEqualTo(progress.getId());
        assertThat(snapshot(progress.getId())).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void 장소정보는_첫문장을_반환하고_설명실패도_정상저장한다(boolean hasOverview) throws Exception {
        User user = user("location");
        Location location = Location.builder().contentId(987654321L).title("장소").address("주소")
                .category("관광지").radius(50).latitude(30).longitude(120).build();
        em.persist(location);
        var mission = mission(location);
        when(tourApi.getLocationOverview(location.getContentId())).thenReturn(hasOverview ? "첫 문장! 다음 문장." : null);
        var result = start(user, mission.getMissionId(), 33.3, 126.3).andExpect(status().isCreated())
                .andExpect(jsonPath("$.location.locationId").value(location.getId()))
                .andExpect(jsonPath("$.location.locationTitle").value("장소"))
                .andExpect(jsonPath("$.location.locationAddress").value("주소"))
                .andExpect(jsonPath("$.location.lat").value(30.0)).andExpect(jsonPath("$.location.lng").value(120.0));
        assertThat(JsonPath.<Object>read(body(result), "$.location.locationDescription")).isEqualTo(hasOverview ? "첫 문장!" : null);
        clear();
        assertThat(progressRows(user.getId())).isEqualTo(1);
        assertThat(items.countByIdTreasureMissionProgressId(findProgress(user.getId(), mission.getMissionId()).getId())).isEqualTo(3);
        verify(tourApi).getLocationOverview(location.getContentId());
    }

    @Test
    void 잘못된_Path와_Query는_400이며_기존기록을_유지한다() throws Exception {
        User user = user("invalid");
        var mission = mission(null);
        var progress = savedProgress(user, mission, 4, true);
        clear();
        var before = snapshot(progress.getId());
        for (String id : List.of("abc", "0", "-1")) {
            error(mvc.perform(request(user, id, "33.3", "126.3")), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        for (String[] values : List.of(new String[]{null, "126.3"}, new String[]{"33.3", null},
                new String[]{"abc", "126.3"}, new String[]{"33.3", "abc"}, new String[]{"90.01", "0"},
                new String[]{"-90.01", "0"}, new String[]{"0", "180.01"}, new String[]{"0", "-180.01"})) {
            error(mvc.perform(request(user, mission.getMissionId(), values[0], values[1])),
                    400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        clear();
        assertThat(snapshot(progress.getId())).isEqualTo(before);
    }

    @Test
    void 인증오류는_401이고_진행도를_생성하지_않는다() throws Exception {
        User user = user("auth");
        var mission = mission(null);
        String valid = tokens.createAccessToken(user).value();
        String expired = new JwtTokenProvider(jwtSigningKey, jwtProperties,
                Clock.fixed(Instant.now().minusSeconds(3600), ZoneOffset.UTC)).createAccessToken(user).value();
        error(mvc.perform(post(URL, mission.getMissionId()).param("latitude", "33.3").param("longitude", "126.3")),
                401, "UNAUTHORIZED", "인증이 필요합니다.");
        error(mvc.perform(post(URL, mission.getMissionId()).param("latitude", "33.3").param("longitude", "126.3")
                .header("Authorization", "Bearer " + valid + "x")),
                401, "INVALID_TOKEN", "유효하지 않은 토큰입니다.");
        error(mvc.perform(post(URL, mission.getMissionId()).param("latitude", "33.3").param("longitude", "126.3")
                .header("Authorization", "Bearer " + expired)), 401, "EXPIRED_TOKEN", "만료된 토큰입니다.");
        User absent = User.builder().email("absent@example.com").passwordHash("hash").build();
        ReflectionTestUtils.setField(absent, "id", Long.MAX_VALUE);
        error(start(absent, mission.getMissionId(), 33.3, 126.3), 401, "UNAUTHORIZED", "인증이 필요합니다.");
        assertThat(progressRows(user.getId())).isZero();
    }

    @Test
    void 없는미션과_다른유형의_공통ID는_404다() throws Exception {
        User user = user("missing");
        Mission otherType = commonMission(MissionTypeCode.CULTURE);
        for (Long id : List.of(Long.MAX_VALUE, otherType.getId())) {
            error(start(user, id, 33.3, 126.3), 404, "TREASURE_MISSION_NOT_FOUND", "보물찾기 미션을 찾을 수 없습니다.");
        }
        assertThat(progressRows(user.getId())).isZero();
    }

    @ParameterizedTest
    @ValueSource(strings = {"NEW", "IN_PROGRESS", "COMPLETED"})
    void 비활성은_모든분기에서_404이고_변경하지_않는다(String state) throws Exception {
        User user = user("inactive");
        var mission = mission(null);
        var progress = state.equals("NEW") ? null : savedProgress(user, mission, 4, state.equals("COMPLETED"));
        mission.changeStatus(MissionActivationStatus.INACTIVE);
        clear();
        var before = progress == null ? null : snapshot(progress.getId());
        error(start(user, mission.getMissionId(), 33.3, 126.3), 404, "TREASURE_MISSION_INACTIVE", "비활성화된 보물찾기 미션입니다.");
        clear();
        if (progress == null) assertThat(progressRows(user.getId())).isZero();
        else assertThat(snapshot(progress.getId())).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void 아이템_일부저장후_실패하면_신규와_재시작_전체를_롤백한다(boolean restart) throws Exception {
        Committed data = commit(restart);
        try {
            var before = restart ? snapshot(data.progressId()) : null;
            doAnswer(invocation -> {
                List<TreasureMissionProgressItem> generated = invocation.getArgument(0);
                items.saveAndFlush(generated.getFirst());
                throw new IllegalStateException("내부 비밀 메시지");
            }).when(items).saveAllAndFlush(any());
            var result = start(data.user(), data.missionId(), 35, 128);
            error(result, 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
            assertThat(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8)).doesNotContain("내부 비밀 메시지");
            if (restart) {
                assertThat(snapshot(data.progressId())).isEqualTo(before);
                assertThat(jdbc.queryForObject("select mission_status from treasure_mission_progress where id=?", String.class, data.progressId())).isEqualTo("COMPLETED");
                assertThat(jdbc.queryForObject("select completed_at from treasure_mission_progress where id=?", java.time.LocalDateTime.class, data.progressId())).isEqualTo(COMPLETED_AT);
                assertThat(jdbc.queryForObject("select found_item_count from treasure_mission_progress where id=?", Integer.class, data.progressId())).isEqualTo(5);
            } else {
                assertThat(progressRows(data.user().getId())).isZero();
                assertThat(jdbc.queryForObject("select count(*) from treasure_mission_progress_item i join treasure_mission_progress p on p.id=i.treasure_mission_progress_id where p.user_id=?", Long.class, data.user().getId())).isZero();
            }
        } finally {
            reset(items);
            clean(data);
        }
    }

    /** 테스트 사용자를 저장한다. */
    private User user(String label) {
        User user = User.builder().email("treasure-" + label + "@example.com").passwordHash("test-hash").point(500).build();
        em.persist(user);
        return user;
    }

    /** 초기 유형을 이름으로 조회해 ID에 의존하지 않는 공통 미션을 저장한다. */
    private Mission commonMission(MissionTypeCode code) {
        var type = em.createQuery("select t from MissionType t where t.type=:code", MissionType.class)
                .setParameter("code", code).getSingleResult();
        Mission mission = Mission.builder().missionType(type).build();
        em.persist(mission);
        return mission;
    }

    /** 생성 상수와 다른 설정 개수를 가진 활성 미션을 저장한다. */
    private TreasureMission mission(Location location) {
        var mission = TreasureMission.builder().mission(commonMission(MissionTypeCode.TREASURE)).location(location)
                .itemTotalCount(8).status(MissionActivationStatus.ACTIVE).point(100).build();
        em.persist(mission);
        em.flush();
        return mission;
    }

    /** 발견 기록을 역순으로 저장해 정렬과 기존 개수 유지 여부를 확인한다. */
    private TreasureMissionProgress savedProgress(User user, TreasureMission mission, int count, boolean completed) {
        var progress = TreasureMissionProgress.builder().user(user).treasureMission(mission).foundItemCount(count)
                .missionStatus(completed ? MissionProgressStatus.COMPLETED : MissionProgressStatus.IN_PROGRESS)
                .completedAt(completed ? COMPLETED_AT : null).build();
        em.persist(progress);
        em.flush();
        for (int index = count; index >= 1; index--) {
            em.persist(TreasureMissionProgressItem.builder().treasureMissionProgress(progress).itemIndex(index)
                    .itemStatus(TreasureItemStatus.FOUND).foundAt(COMPLETED_AT)
                    .latitude(33.3 + index * .001).longitude(126.3 + index * .001).build());
        }
        return progress;
    }

    /** 사용자 인증과 Query 좌표를 가진 HTTP 요청을 만든다. */
    private MockHttpServletRequestBuilder request(User user, Object id, String latitude, String longitude) {
        var request = post(URL, id).header("Authorization", "Bearer " + tokens.createAccessToken(user).value());
        if (latitude != null) request.param("latitude", latitude);
        if (longitude != null) request.param("longitude", longitude);
        return request;
    }

    /** 실제 시작/이어하기 요청을 보낸다. */
    private ResultActions start(User user, Long missionId, double lat, double lng) throws Exception {
        return mvc.perform(request(user, missionId, String.valueOf(lat), String.valueOf(lng)));
    }

    /** 응답 JSON을 비교 가능한 Map으로 읽는다. */
    private Map<String, Object> body(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), "$");
    }

    /** 오류 상태·code·message를 함께 확인한다. */
    private void error(ResultActions result, int statusCode, String code, String message) throws Exception {
        result.andExpect(status().is(statusCode)).andExpect(jsonPath("$.code").value(code)).andExpect(jsonPath("$.message").value(message));
    }

    /** 영속성 컨텍스트를 비워 실제 DB 저장 결과를 읽는다. */
    private void clear() { em.flush(); em.clear(); }

    /** 사용자·미션 쌍으로 진행도를 조회한다. */
    private TreasureMissionProgress findProgress(Long userId, Long missionId) {
        return em.createQuery("select p from TreasureMissionProgress p where p.user.id=:userId and p.treasureMission.missionId=:missionId", TreasureMissionProgress.class)
                .setParameter("userId", userId).setParameter("missionId", missionId).getSingleResult();
    }

    /** 해당 사용자의 진행도 행 수를 실제 DB에서 읽는다. */
    private long progressRows(Long userId) {
        return jdbc.queryForObject("select count(*) from treasure_mission_progress where user_id=?", Long.class, userId);
    }

    /** 보물 좌표·발견 시각을 포함한 전체 행을 실제 DB에서 비교한다. */
    private List<Map<String, Object>> snapshot(Long id) {
        return jdbc.queryForList("select * from treasure_mission_progress_item where treasure_mission_progress_id=? order by item_index", id);
    }

    /** 사용자 포인트·획득·보상 지급 이력 전체를 비교한다. */
    private List<Object> rewardSnapshot(Long userId) {
        return List.of(jdbc.queryForObject("select point from user where id=?", Integer.class, userId),
                jdbc.queryForList("select * from acquired_ar_character where user_id=?", userId),
                jdbc.queryForList("select * from acquired_coupon where user_id=?", userId),
                jdbc.queryForList("select * from mission_reward_status where user_id=?", userId));
    }

    /** 실제 롤백 검증을 위해 테스트 전용 데이터를 커밋한다. */
    private Committed commit(boolean restart) {
        return transactions.execute(transaction -> {
            User user = user("committed");
            var mission = mission(null);
            var progress = restart ? savedProgress(user, mission, 5, true) : null;
            em.flush();
            return new Committed(user, mission.getMissionId(), progress == null ? null : progress.getId());
        });
    }

    /** 직접 커밋한 행만 FK 순서대로 정리한다. */
    private void clean(Committed data) {
        jdbc.update("delete i from treasure_mission_progress_item i join treasure_mission_progress p on p.id=i.treasure_mission_progress_id where p.user_id=?", data.user().getId());
        jdbc.update("delete from treasure_mission_progress where user_id=?", data.user().getId());
        jdbc.update("delete from treasure_mission where mission_id=?", data.missionId());
        jdbc.update("delete from mission where id=?", data.missionId());
        jdbc.update("delete from user where id=?", data.user().getId());
    }

    /** 직접 정리할 테스트 전용 행의 식별자이다. */
    private record Committed(User user, Long missionId, Long progressId) {
    }
}
