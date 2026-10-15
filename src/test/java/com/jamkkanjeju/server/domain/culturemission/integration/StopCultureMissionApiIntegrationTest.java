package com.jamkkanjeju.server.domain.culturemission.integration;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.domain.auth.config.JwtProperties;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.culturemission.entity.*;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.service.NextLocationRecommender;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.home.entity.*;
import com.jamkkanjeju.server.domain.treasurehunt.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.*;
import org.springframework.transaction.support.TransactionTemplate;

/** 실제 HTTP·DB에서 중단, 보상, 재요청과 서비스 트랜잭션 롤백을 검증한다. */
@SpringBootTest(properties = {
        "app.jwt.secret-key=dGVzdC1zZWNyZXQta2V5LWZvci1qd3Qtc2lnbmluZy0zMmJ5dGVzIQ==",
        "app.jwt.access-token-expiration=30m", "app.jwt.refresh-token-expiration=14d",
        "app.dev-auth.enabled=false", "logging.level.org.hibernate.SQL=warn"
})
@AutoConfigureMockMvc
@Transactional
class StopCultureMissionApiIntegrationTest {
    static final String URL = "/api/v2/culture-missions/{id}/progress/stop";
    static final LocalDateTime PREVIOUS = LocalDateTime.of(2026, 10, 1, 12, 0);
    static final Instant NOW = Instant.now().truncatedTo(ChronoUnit.SECONDS);
    static final ZoneId ZONE = ZoneId.of("Asia/Seoul");
    @Autowired MockMvc mvc;
    @Autowired JwtTokenProvider tokens;
    @Autowired SecretKey jwtSigningKey;
    @Autowired JwtProperties jwtProperties;
    @Autowired EntityManager em;
    @Autowired TransactionTemplate transactions;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean TourApiClient images;
    @MockitoBean Clock clock;
    @MockitoSpyBean NextLocationRecommender recommender;

    @BeforeEach void fixedClock() {
        when(clock.instant()).thenReturn(NOW);
        when(clock.getZone()).thenReturn(ZONE);
    }

    /** 테스트 전용 사용자·장소·보상과 아직 마지막 문제에 도달하지 않은 진행도를 준비한다. */
    private Data data(int correctCount) {
        var user = User.builder().email("stop-cm-" + UUID.randomUUID() + "@example.com")
                .passwordHash("{test}").nickname("중단테스트").build();
        em.persist(user);
        var location = Location.builder().contentId(7_000_000_000L + Math.floorMod(UUID.randomUUID().getLeastSignificantBits(), 1_000_000_000L))
                .title("중단테스트 장소").address("테스트 주소").category("관광지").radius(50)
                .latitude(10).longitude(10).build();
        em.persist(location);
        var coupon = Coupon.builder().location(location).couponPrice(3000).build();
        em.persist(coupon);
        var character = ArCharacter.builder().name("중단테스트 캐릭터").description("설명").storyTitle("이야기")
                .acquireCondition("문화미션").imgUrl("https://example.com/character.jpg")
                .representativeColor("blue").hashtags(List.of("테스트")).build();
        em.persist(character);
        var mission = CultureMission.builder().mission(common(MissionTypeCode.CULTURE))
                .status(MissionActivationStatus.ACTIVE).arCharacter(character).point(100).coupon(coupon).build();
        em.persist(mission); em.flush();
        for (int i = 1; i <= 5; i++) {
            em.persist(CultureMissionQuiz.builder().cultureMission(mission).quizIndex(i)
                    .question("문제 " + i).answer("정답" + i).build());
        }
        var progress = CultureMissionProgress.builder().user(user).cultureMission(mission)
                .missionStatus(MissionProgressStatus.IN_PROGRESS).currentQuizIndex(4)
                .correctCount(correctCount).lastCompletedAt(PREVIOUS).build();
        em.persist(progress); em.flush();
        return new Data(user, mission, progress, location, coupon, character);
    }
    private Mission common(MissionTypeCode code) {
        var type = em.createQuery("select t from MissionType t where t.type=:type", MissionType.class)
                .setParameter("type", code).getSingleResult();
        var mission = Mission.builder().missionType(type).build(); em.persist(mission); return mission;
    }
    private record Data(User user, CultureMission mission, CultureMissionProgress progress,
                        Location location, Coupon coupon, ArCharacter character) {}
    private String bearer(User user) { return "Bearer " + tokens.createAccessToken(user).value(); }
    private ResultActions stop(Data d) throws Exception {
        return mvc.perform(patch(URL, d.progress().getId()).header("Authorization", bearer(d.user()))
                .param("latitude", "10").param("longitude", "10"));
    }
    private void reload() { em.flush(); em.clear(); }
    private CultureMissionProgress progress(Data d) { return em.find(CultureMissionProgress.class, d.progress().getId()); }
    private MissionRewardStatus rewards(Data d) {
        return em.find(MissionRewardStatus.class,
                new MissionRewardStatusId(d.mission().getMissionId(), d.user().getId()));
    }
    private long acquired(String entity, Data d) {
        return em.createQuery("select count(a) from " + entity + " a where a.user.id=:id", Long.class)
                .setParameter("id", d.user().getId()).getSingleResult();
    }
    private void error(ResultActions result, int status, String code, String message) throws Exception {
        result.andExpect(status().is(status)).andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.message").value(message));
    }
    private void unchanged(Data d) {
        reload();
        assertThat(progress(d).getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        assertThat(progress(d).getCurrentQuizIndex()).isEqualTo(4);
        assertThat(progress(d).getCorrectCount()).isEqualTo(d.progress().getCorrectCount());
        assertThat(progress(d).getLastCompletedAt()).isEqualTo(PREVIOUS);
        assertThat(em.find(User.class, d.user().getId()).getPoint()).isZero();
        assertThat(rewards(d)).isNull();
        assertThat(acquired("AcquiredArCharacter", d)).isZero();
        assertThat(acquired("AcquiredCoupon", d)).isZero();
    }

    @ParameterizedTest @ValueSource(ints = {0, 1, 2, 3})
    void stopCompletesWithoutGradingAndGrantsOnlyStoredCount(int correctCount) throws Exception {
        Data d = data(correctCount); Data other = data(1); reload();
        var result = stop(d).andExpect(status().isOk())
                .andExpect(jsonPath("$.missionProgressStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.quizCount").value(5)).andExpect(jsonPath("$.correctNumber").value(correctCount))
                .andExpect(jsonPath("$.nextLocation.id").value(d.location().getId()))
                .andExpect(jsonPath("$.nextLocation.distanceMeter").value(0))
                .andExpect(jsonPath("$.nextLocation.locationImageUrl").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.nextLocation.mission").value(org.hamcrest.Matchers.nullValue()));
        Map<String, Object> body = JsonPath.read(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), "$");
        assertThat(body).containsOnlyKeys("missionProgressStatus", "quizCount", "correctNumber", "nextLocation", "reward");
        if (correctCount >= 1) result.andExpect(jsonPath("$.reward.arCharacter.id").value(d.character().getId()));
        else result.andExpect(jsonPath("$.reward.arCharacter").value(org.hamcrest.Matchers.nullValue()));
        if (correctCount >= 2) result.andExpect(jsonPath("$.reward.point").value(100));
        else result.andExpect(jsonPath("$.reward.point").value(org.hamcrest.Matchers.nullValue()));
        if (correctCount >= 3) result.andExpect(jsonPath("$.reward.coupon.couponPrice").value(3000));
        else result.andExpect(jsonPath("$.reward.coupon").value(org.hamcrest.Matchers.nullValue()));
        reload();
        assertThat(progress(d).getMissionStatus()).isEqualTo(MissionProgressStatus.COMPLETED);
        assertThat(progress(d).getCurrentQuizIndex()).isEqualTo(4);
        assertThat(progress(d).getCorrectCount()).isEqualTo(correctCount);
        assertThat(progress(d).getLastCompletedAt()).isEqualTo(LocalDateTime.ofInstant(NOW, ZONE));
        assertThat(em.find(User.class, d.user().getId()).getPoint()).isEqualTo(correctCount >= 2 ? 100 : 0);
        assertThat(acquired("AcquiredArCharacter", d)).isEqualTo(correctCount >= 1 ? 1 : 0);
        assertThat(acquired("AcquiredCoupon", d)).isEqualTo(correctCount >= 3 ? 1 : 0);
        if (correctCount == 0) assertThat(rewards(d)).isNull();
        else {
            assertThat(rewards(d).isArCharacterRewardGranted()).isTrue();
            assertThat(rewards(d).isPointRewardGranted()).isEqualTo(correctCount >= 2);
            assertThat(rewards(d).isCouponRewardGranted()).isEqualTo(correctCount >= 3);
        }
        error(stop(d), 404, "CULTURE_MISSION_PROGRESS_NOT_FOUND", "진행 중인 문화 미션 진행도를 찾을 수 없습니다.");
        reload();
        assertThat(acquired("AcquiredArCharacter", d)).isEqualTo(correctCount >= 1 ? 1 : 0);
        assertThat(progress(d).getLastCompletedAt()).isEqualTo(LocalDateTime.ofInstant(NOW, ZONE));
        unchanged(other);
    }

    @Test void retriesUseRemainingRewardsAndDoNotDuplicateOwnedCoupon() throws Exception {
        Data d = data(1); reload();
        stop(d).andExpect(status().isOk()).andExpect(jsonPath("$.reward.arCharacter.id").isNumber()); reload();
        progress(d).restart(); ReflectionTestUtils.setField(progress(d), "correctCount", 1); reload();
        stop(d).andExpect(status().isOk()).andExpect(jsonPath("$.reward.point").value(100))
                .andExpect(jsonPath("$.reward.arCharacter").value(org.hamcrest.Matchers.nullValue())); reload();
        em.persist(AcquiredCoupon.builder().user(em.find(User.class, d.user().getId()))
                .coupon(em.find(Coupon.class, d.coupon().getId())).acquiredAt(PREVIOUS).build());
        ReflectionTestUtils.setField(em.find(Coupon.class, d.coupon().getId()), "location", null);
        progress(d).restart(); ReflectionTestUtils.setField(progress(d), "correctCount", 1); reload();
        stop(d).andExpect(status().isOk()).andExpect(jsonPath("$.reward.coupon.couponPrice").value(3000))
                .andExpect(jsonPath("$.reward.coupon.couponLocation").value(org.hamcrest.Matchers.nullValue())); reload();
        progress(d).restart(); ReflectionTestUtils.setField(progress(d), "correctCount", 3); reload();
        stop(d).andExpect(status().isOk()).andExpect(jsonPath("$.reward.arCharacter").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.reward.point").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.reward.coupon").value(org.hamcrest.Matchers.nullValue())); reload();
        assertThat(em.find(User.class, d.user().getId()).getPoint()).isEqualTo(100);
        assertThat(acquired("AcquiredArCharacter", d)).isEqualTo(1);
        assertThat(acquired("AcquiredCoupon", d)).isEqualTo(1);
        assertThat(em.find(AcquiredCoupon.class, new AcquiredCouponId(d.coupon().getId(), d.user().getId())).getAcquiredAt()).isEqualTo(PREVIOUS);
    }

    @Test void nextPlaceIncludesOnlyActiveMissionAndPassesImage() throws Exception {
        Data d = data(0);
        var active = TreasureMission.builder().mission(common(MissionTypeCode.TREASURE)).location(d.location())
                .itemTotalCount(3).status(MissionActivationStatus.ACTIVE).build(); em.persist(active);
        em.persist(CooperativeMission.builder().mission(common(MissionTypeCode.COOPERATIVE)).location(d.location())
                .status(MissionActivationStatus.INACTIVE).build());
        when(images.getLocationImageUrl(d.location().getContentId())).thenReturn("https://example.com/place.jpg"); reload();
        stop(d).andExpect(status().isOk()).andExpect(jsonPath("$.nextLocation.mission.id").value(active.getMissionId()))
                .andExpect(jsonPath("$.nextLocation.mission.missionType").value("TREASURE"))
                .andExpect(jsonPath("$.nextLocation.locationImageUrl").value("https://example.com/place.jpg"));
    }

    @Test void anotherUserUnknownAndCompletedProgressAreRejected() throws Exception {
        Data d = data(2); Data other = data(1); reload();
        error(mvc.perform(patch(URL, d.progress().getId()).header("Authorization", bearer(other.user()))
                .param("latitude", "10").param("longitude", "10")), 404,
                "CULTURE_MISSION_PROGRESS_NOT_FOUND", "진행 중인 문화 미션 진행도를 찾을 수 없습니다.");
        error(mvc.perform(patch(URL, Long.MAX_VALUE).header("Authorization", bearer(d.user()))
                .param("latitude", "10").param("longitude", "10")), 404,
                "CULTURE_MISSION_PROGRESS_NOT_FOUND", "진행 중인 문화 미션 진행도를 찾을 수 없습니다.");
        unchanged(d); unchanged(other);
        progress(d).complete(PREVIOUS); reload();
        error(stop(d), 404, "CULTURE_MISSION_PROGRESS_NOT_FOUND", "진행 중인 문화 미션 진행도를 찾을 수 없습니다.");
        reload(); assertThat(progress(d).getLastCompletedAt()).isEqualTo(PREVIOUS);
        assertThat(rewards(d)).isNull();
    }

    @Test void inactiveMissionCannotBeStopped() throws Exception {
        Data d = data(2); ReflectionTestUtils.setField(d.mission(), "status", MissionActivationStatus.INACTIVE); reload();
        error(stop(d), 404, "CULTURE_MISSION_INACTIVE", "비활성화된 문화 미션입니다."); unchanged(d);
        verifyNoInteractions(images);
    }

    @Test void invalidPathMissingMalformedAndOutOfRangeCoordinatesReturn400() throws Exception {
        Data d = data(1); reload();
        for (String[] values : new String[][] {{"abc", "10", "10"}, {d.progress().getId().toString(), null, "10"},
                {d.progress().getId().toString(), "10", null}, {d.progress().getId().toString(), "abc", "10"},
                {d.progress().getId().toString(), "-91", "10"}, {d.progress().getId().toString(), "91", "10"},
                {d.progress().getId().toString(), "10", "-181"}, {d.progress().getId().toString(), "10", "181"}}) {
            var request = patch(URL, values[0]).header("Authorization", bearer(d.user()));
            if (values[1] != null) request.param("latitude", values[1]);
            if (values[2] != null) request.param("longitude", values[2]);
            error(mvc.perform(request), 400, "INVALID_REQUEST", "요청값이 올바르지 않습니다.");
        }
        unchanged(d);
    }

    @Test void authenticationErrorsPreserveProgressAndRewards() throws Exception {
        Data d = data(2); reload();
        String expired = new JwtTokenProvider(jwtSigningKey, jwtProperties,
                Clock.fixed(NOW.minus(Duration.ofHours(1)), ZONE)).createAccessToken(d.user()).value();
        var ghost = User.builder().email("ghost-stop@example.com").passwordHash("test").build();
        ReflectionTestUtils.setField(ghost, "id", Long.MAX_VALUE);
        String[] headers = {"", bearer(d.user()) + "a", "Bearer " + expired, bearer(ghost)};
        String[] codes = {"UNAUTHORIZED", "INVALID_TOKEN", "EXPIRED_TOKEN", "UNAUTHORIZED"};
        String[] messages = {"인증이 필요합니다.", "유효하지 않은 토큰입니다.", "만료된 토큰입니다.", "인증이 필요합니다."};
        for (int i = 0; i < headers.length; i++) {
            var request = patch(URL, d.progress().getId()).param("latitude", "10").param("longitude", "10");
            if (!headers[i].isEmpty()) request.header("Authorization", headers[i]);
            error(mvc.perform(request), 401, codes[i], messages[i]);
        }
        unchanged(d);
    }

    @Test @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void recommendationFailureRollsBackCompletionAndAllRewards() throws Exception {
        Data d = transactions.execute(tx -> data(3));
        try {
            doReturn(Optional.empty()).when(recommender).recommend(10, 10);
            var result = stop(d);
            error(result, 500, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다.");
            assertThat(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8))
                    .doesNotContain("추천 가능한 장소", "progressId", "userId");
            transactions.executeWithoutResult(tx -> unchanged(d));
        } finally {
            reset(recommender);
            jdbc.update("delete from acquired_ar_character where user_id=?", d.user().getId());
            jdbc.update("delete from acquired_coupon where user_id=?", d.user().getId());
            jdbc.update("delete from mission_reward_status where user_id=?", d.user().getId());
            jdbc.update("delete from culture_mission_progress where user_id=?", d.user().getId());
            jdbc.update("delete from culture_mission_quiz where culture_mission_id=?", d.mission().getMissionId());
            jdbc.update("delete from culture_mission where mission_id=?", d.mission().getMissionId());
            jdbc.update("delete from mission where id=?", d.mission().getMissionId());
            jdbc.update("delete from coupon where id=?", d.coupon().getId());
            jdbc.update("delete from location where id=?", d.location().getId());
            jdbc.update("delete from ar_character where id=?", d.character().getId());
            jdbc.update("delete from user where id=?", d.user().getId());
        }
    }
}
