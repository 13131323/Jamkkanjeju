package com.jamkkanjeju.server.domain.mission.integration;

import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.domain.auth.config.JwtProperties;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/** 실제 JWT·HTTP·JPA·MySQL로 미션 홈 응답과 조회 전용 데이터 유지를 검증한다. */
@SpringBootTest(properties = {
        "app.jwt.secret-key=dGVzdC1zZWNyZXQta2V5LWZvci1qd3Qtc2lnbmluZy0zMmJ5dGVzIQ==",
        "app.jwt.access-token-expiration=30m", "app.jwt.refresh-token-expiration=14d",
        "app.dev-auth.enabled=false", "logging.level.org.hibernate.SQL=warn"
})
@AutoConfigureMockMvc
@Transactional
class GetMissionHomeApiIntegrationTest extends MySqlIntegrationTestSupport {

    private static final String URL = "/api/v2/missions/{missionId}";
    private static final Instant NOW = Instant.parse("2026-10-15T03:00:00Z");
    private static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    @Autowired MockMvc mockMvc;
    @Autowired EntityManager entityManager;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired JwtTokenProvider tokens;
    @Autowired SecretKey jwtSigningKey;
    @Autowired JwtProperties jwtProperties;
    @MockitoBean Clock clock;
    @MockitoSpyBean MissionRewardStatusRepository rewardRepository;

    @BeforeEach
    void fixedClock() {
        when(clock.instant()).thenReturn(NOW);
        when(clock.getZone()).thenReturn(ZONE);
    }

    /** 다른 테스트나 초기 사용자 ID와 무관한 사용자를 준비한다. */
    private User user() {
        User user = User.builder().email("mission-home-" + UUID.randomUUID() + "@example.com")
                .passwordHash("{test}").nickname("미션홈테스트").point(17).build();
        entityManager.persist(user);
        return user;
    }

    /** 유형 안내값을 고정하고 공통 미션과 해당 유형의 보상 상세를 준비한다. */
    private Data data(MissionTypeCode code, MissionActivationStatus status, boolean withRewards, boolean withLocation) {
        User user = user();
        Mission mission = common(code);
        ArCharacter character = null;
        Coupon coupon = null;
        if (withRewards) {
            character = ArCharacter.builder().name("돌담이").description("설명").storyTitle("이야기")
                    .acquireCondition("미션").imgUrl("https://example.com/character.png")
                    .representativeColor("blue").hashtags(List.of("테스트")).build();
            entityManager.persist(character);
            Location location = null;
            if (withLocation) {
                location = Location.builder().contentId(8_000_000_000L
                                + Math.floorMod(UUID.randomUUID().getLeastSignificantBits(), 1_000_000_000L))
                        .title("쿠폰 사용처").address("테스트 주소").category("관광지")
                        .radius(50).latitude(33).longitude(126).build();
                entityManager.persist(location);
            }
            coupon = Coupon.builder().couponPrice(3000).location(location).build();
            entityManager.persist(coupon);
        }
        Integer point = withRewards ? 100 : null;
        switch (code) {
            case CULTURE -> entityManager.persist(CultureMission.builder().mission(mission).status(status)
                    .arCharacter(character).point(point).coupon(coupon).build());
            case COOPERATIVE -> entityManager.persist(CooperativeMission.builder().mission(mission).status(status)
                    .arCharacter(character).point(point).coupon(coupon).build());
            case TREASURE -> entityManager.persist(TreasureMission.builder().mission(mission).status(status)
                    .itemTotalCount(3).arCharacter(character).point(point).coupon(coupon).build());
        }
        entityManager.flush();
        return new Data(user, mission, character, coupon);
    }

    private Mission common(MissionTypeCode code) {
        MissionType type = entityManager.createQuery("select t from MissionType t where t.type=:type", MissionType.class)
                .setParameter("type", code).getSingleResult();
        ReflectionTestUtils.setField(type, "title", "미션 제목");
        ReflectionTestUtils.setField(type, "description", "미션 설명");
        ReflectionTestUtils.setField(type, "steps", List.of(
                new MissionStep(2, "두 번째", "설명2"), new MissionStep(1, "첫 번째", "설명1")));
        Mission mission = Mission.builder().missionType(type).build();
        entityManager.persist(mission);
        return mission;
    }

    private record Data(User user, Mission mission, ArCharacter character, Coupon coupon) {
    }

    private String bearer(User user) {
        return "Bearer " + tokens.createAccessToken(user).value();
    }

    private ResultActions request(User user, Object id) throws Exception {
        return mockMvc.perform(get(URL, id).header("Authorization", bearer(user)));
    }

    private void reload() {
        entityManager.flush();
        entityManager.clear();
    }

    /** 조회가 보상·포인트·획득·진행도 및 안내 데이터를 변경하지 않았는지 비교할 DB 스냅샷이다. */
    private Map<String, List<Map<String, Object>>> snapshot() {
        reload();
        Map<String, List<Map<String, Object>>> snapshot = new LinkedHashMap<>();
        for (String table : List.of("user", "mission", "mission_type", "mission_reward_status", "culture_mission",
                "cooperative_mission", "treasure_mission", "culture_mission_progress", "treasure_mission_progress",
                "cooperative_mission_progress", "acquired_ar_character", "acquired_coupon")) {
            snapshot.put(table, jdbcTemplate.queryForList("select * from " + table));
        }
        return snapshot;
    }

    private void error(ResultActions result, int statusCode, String code, String message) throws Exception {
        result.andExpect(status().is(statusCode)).andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.message").value(message));
    }

    @ParameterizedTest
    @EnumSource(MissionTypeCode.class)
    void 유형별_공통_ID로_전체_보상을_조회하고_반복해도_DB는_유지된다(MissionTypeCode code) throws Exception {
        Data data = data(code, MissionActivationStatus.ACTIVE, true, true);
        var before = snapshot();
        var result = request(data.user(), data.mission().getId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(data.mission().getId()))
                .andExpect(jsonPath("$.missionType").value(code.name()))
                .andExpect(jsonPath("$.missionTitle").value("미션 제목"))
                .andExpect(jsonPath("$.description").value("미션 설명"))
                .andExpect(jsonPath("$.steps[0].step").value(1))
                .andExpect(jsonPath("$.steps[0].stepTitle").value("첫 번째"))
                .andExpect(jsonPath("$.steps[0].description").value("설명1"))
                .andExpect(jsonPath("$.steps[1].step").value(2))
                .andExpect(jsonPath("$.remainingReward.arCharacter.id").value(data.character().getId()))
                .andExpect(jsonPath("$.remainingReward.arCharacter.name").value("돌담이"))
                .andExpect(jsonPath("$.remainingReward.arCharacter.imageUrl").value("https://example.com/character.png"))
                .andExpect(jsonPath("$.remainingReward.point").value(100))
                .andExpect(jsonPath("$.remainingReward.coupon.couponLocation").value("쿠폰 사용처"))
                .andExpect(jsonPath("$.remainingReward.coupon.couponPrice").value(3000))
                .andReturn();
        String body = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        Map<String, Object> json = JsonPath.read(body, "$");
        assertThat(json.keySet()).containsExactlyInAnyOrder("id", "missionType", "missionTitle", "description", "remainingReward", "steps");
        assertThat(request(data.user(), data.mission().getId()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8)).isEqualTo(body);
        assertThat(snapshot()).isEqualTo(before);
    }

    @ParameterizedTest
    @EnumSource(MissionTypeCode.class)
    void 지급_상태는_사용자와_미션별로_격리되고_전부_지급하면_빈_보상이다(MissionTypeCode code) throws Exception {
        Data data = data(code, MissionActivationStatus.ACTIVE, true, false);
        User otherUser = user();
        Data otherMission = data(code, MissionActivationStatus.ACTIVE, true, false);
        var otherStatus = MissionRewardStatus.builder().mission(otherMission.mission()).user(data.user()).build();
        otherStatus.grantArCharacterReward();
        otherStatus.grantPointReward();
        otherStatus.grantCouponReward();
        entityManager.persist(otherStatus);
        var saved = MissionRewardStatus.builder().mission(data.mission()).user(data.user()).build();
        saved.grantArCharacterReward();
        entityManager.persist(saved);
        var before = snapshot();
        request(data.user(), data.mission().getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.remainingReward.arCharacter").value(nullValue()))
                .andExpect(jsonPath("$.remainingReward.point").value(100))
                .andExpect(jsonPath("$.remainingReward.coupon.couponLocation").value(nullValue()))
                .andExpect(jsonPath("$.remainingReward.coupon.couponPrice").value(3000));
        request(otherUser, data.mission().getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.remainingReward.arCharacter.id").value(data.character().getId()));
        assertThat(snapshot()).isEqualTo(before);
        var reloaded = entityManager.find(MissionRewardStatus.class,
                new MissionRewardStatusId(data.mission().getId(), data.user().getId()));
        reloaded.grantPointReward();
        reloaded.grantCouponReward();
        before = snapshot();
        request(data.user(), data.mission().getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.remainingReward").isMap())
                .andExpect(jsonPath("$.remainingReward.arCharacter").value(nullValue()))
                .andExpect(jsonPath("$.remainingReward.point").value(nullValue()))
                .andExpect(jsonPath("$.remainingReward.coupon").value(nullValue()));
        assertThat(snapshot()).isEqualTo(before);
    }

    @ParameterizedTest
    @EnumSource(MissionTypeCode.class)
    void 보상과_장소가_없어도_활성_미션은_조회된다(MissionTypeCode code) throws Exception {
        Data data = data(code, MissionActivationStatus.ACTIVE, false, false);
        var before = snapshot();
        request(data.user(), data.mission().getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.remainingReward").isMap())
                .andExpect(jsonPath("$.remainingReward.arCharacter").value(nullValue()))
                .andExpect(jsonPath("$.remainingReward.point").value(nullValue()))
                .andExpect(jsonPath("$.remainingReward.coupon").value(nullValue()));
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 진행도가_없거나_진행중이거나_완료여도_지급상태만_사용한다() throws Exception {
        Data data = data(MissionTypeCode.CULTURE, MissionActivationStatus.ACTIVE, true, false);
        String body = request(data.user(), data.mission().getId()).andReturn().getResponse().getContentAsString();
        CultureMission detail = entityManager.find(CultureMission.class, data.mission().getId());
        var progress = CultureMissionProgress.builder().cultureMission(detail).user(data.user())
                .missionStatus(MissionProgressStatus.IN_PROGRESS).currentQuizIndex(1).correctCount(0).build();
        entityManager.persist(progress);
        var before = snapshot();
        assertThat(request(data.user(), data.mission().getId()).andReturn().getResponse().getContentAsString()).isEqualTo(body);
        assertThat(snapshot()).isEqualTo(before);
        entityManager.find(CultureMissionProgress.class, progress.getId())
                .complete(java.time.LocalDateTime.of(2026, 10, 15, 12, 0));
        before = snapshot();
        assertThat(request(data.user(), data.mission().getId()).andReturn().getResponse().getContentAsString()).isEqualTo(body);
        assertThat(snapshot()).isEqualTo(before);
    }

    @ParameterizedTest
    @EnumSource(MissionTypeCode.class)
    void 비활성_미션은_404이고_데이터는_유지된다(MissionTypeCode code) throws Exception {
        Data data = data(code, MissionActivationStatus.INACTIVE, true, false);
        var before = snapshot();
        error(request(data.user(), data.mission().getId()), 404, "MISSION_INACTIVE", "비활성화된 미션입니다.");
        assertThat(snapshot()).isEqualTo(before);
    }

    @ParameterizedTest
    @EnumSource(MissionTypeCode.class)
    void 해당_유형의_상세가_없으면_404이다(MissionTypeCode code) throws Exception {
        User user = user();
        Mission mission = common(code);
        var before = snapshot();
        error(request(user, mission.getId()), 404, "MISSION_NOT_FOUND", "미션을 찾을 수 없습니다.");
        error(request(user, Long.MAX_VALUE), 404, "MISSION_NOT_FOUND", "미션을 찾을 수 없습니다.");
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 잘못된_Path는_400이고_데이터는_유지된다() throws Exception {
        Data data = data(MissionTypeCode.CULTURE, MissionActivationStatus.ACTIVE, true, false);
        var before = snapshot();
        for (String id : List.of("text", "1.5", "9223372036854775808", "-9223372036854775809")) {
            error(request(data.user(), id), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 토큰_오류와_사용자_없음은_401이다() throws Exception {
        Data data = data(MissionTypeCode.CULTURE, MissionActivationStatus.ACTIVE, true, false);
        var before = snapshot();
        error(mockMvc.perform(get(URL, data.mission().getId())), 401, "UNAUTHORIZED", "인증이 필요합니다.");
        error(mockMvc.perform(get(URL, data.mission().getId()).header("Authorization", "Bearer invalid")),
                401, "INVALID_TOKEN", "유효하지 않은 토큰입니다.");
        var expired = new JwtTokenProvider(jwtSigningKey, jwtProperties, Clock.fixed(NOW.minusSeconds(3600), ZONE));
        error(mockMvc.perform(get(URL, data.mission().getId()).header("Authorization",
                "Bearer " + expired.createAccessToken(data.user()).value())), 401, "EXPIRED_TOKEN", "만료된 토큰입니다.");
        error(mockMvc.perform(get(URL, data.mission().getId()).header("Authorization",
                "Bearer " + tokens.createRefreshToken(data.user()).value())), 401, "INVALID_TOKEN", "유효하지 않은 토큰입니다.");
        error(request(activeUser(Long.MAX_VALUE), data.mission().getId()), 401, "UNAUTHORIZED", "인증이 필요합니다.");
        assertThat(snapshot()).isEqualTo(before);
    }

    @Test
    void 보상_조회_실패는_500이고_내부_원인과_데이터_변경이_없다() throws Exception {
        Data data = data(MissionTypeCode.CULTURE, MissionActivationStatus.ACTIVE, true, false);
        var before = snapshot();
        doThrow(new IllegalStateException("테스트 내부 지급 조회 실패")).when(rewardRepository).findById(any());
        var response = request(data.user(), data.mission().getId());
        error(response, 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
        assertThat(response.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8))
                .doesNotContain("테스트 내부 지급 조회 실패");
        assertThat(snapshot()).isEqualTo(before);
    }
}
