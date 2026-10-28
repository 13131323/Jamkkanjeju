package com.jamkkanjeju.server.domain.home.integration;

import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jamkkanjeju.server.domain.auth.config.JwtProperties;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionProgress;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionRoleProgress;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeRoleCard;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantRole;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantStatus;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionQuiz;
import com.jamkkanjeju.server.domain.guestbook.entity.Guestbook;
import com.jamkkanjeju.server.domain.guestbook.entity.GuestbookStatus;
import com.jamkkanjeju.server.domain.guestbook.entity.LocationGuestbook;
import com.jamkkanjeju.server.domain.guestbook.entity.RoadGuestbook;
import com.jamkkanjeju.server.domain.guestbook.service.GuestbookCounter;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionType;
import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * GET /api/v2/users/me/home 를 실제 HTTP 요청 흐름(JWT 필터 → 컨트롤러 → 서비스 → MySQL)으로 검증한다.
 * 기존 초기 데이터와 섞이지 않도록 요청 위치를 제주에서 먼 좌표로 두고 테스트용 장소를 그 근처에 만든다.
 * 미션 유형, 역할 카드, 온보딩 결과는 Flyway 초기 데이터를 쓰고, 각 테스트는 끝나면 롤백된다.
 */
@SpringBootTest(properties = {
        "app.jwt.secret-key=dGVzdC1zZWNyZXQta2V5LWZvci1qd3Qtc2lnbmluZy0zMmJ5dGVzIQ==",
        "app.jwt.access-token-expiration=30m",
        "app.jwt.refresh-token-expiration=14d",
        "app.dev-auth.enabled=false",
        "logging.level.org.hibernate.SQL=warn"
})
@AutoConfigureMockMvc
@Transactional
class HomeApiIntegrationTest extends MySqlIntegrationTestSupport {

    private static final String URL = "/api/v2/users/me/home";
    /** 테스트 요청 위치. 초기 데이터의 제주 장소와 수천 km 떨어져 있다. */
    private static final double BASE_LAT = 10.0;
    private static final double BASE_LNG = 10.0;
    /** 반지름 6,371km 구에서 위도 1도에 해당하는 거리(m) */
    private static final double METER_PER_LATITUDE_DEGREE = 111_194.926_644_558_73;
    private static final AtomicLong CONTENT_ID = new AtomicLong(9_000_000_000L);

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private JwtTokenProvider jwtTokenProvider;
    @Autowired
    private SecretKey jwtSigningKey;
    @Autowired
    private JwtProperties jwtProperties;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private EntityManager entityManager;
    @MockitoSpyBean
    private GuestbookCounter guestbookCounter;

    @Test
    void 정상_요청이면_200과_명세의_필드와_형식을_반환한다() throws Exception {
        User user = saveUser("home-it@example.com");
        TreasureMission treasure = treasureMission(northOfBase("보물 장소", 300), 5, MissionActivationStatus.ACTIVE);
        CooperativeMission cooperative = cooperativeMission(northOfBase("협동 장소", 600), MissionActivationStatus.ACTIVE);
        TreasureMission progressing = treasureMission(northOfBase("진행 보물", 900), 4, MissionActivationStatus.ACTIVE);
        treasureProgress(user, progressing, 1, MissionProgressStatus.IN_PROGRESS);
        entityManager.flush();

        getHome(user, BASE_LAT, BASE_LNG)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.missionRecommend").isArray())
                .andExpect(jsonPath("$.progressMission").isArray())
                .andExpect(jsonPath("$.guestbookCount").isNumber())
                .andExpect(jsonPath("$.characterImgUrl").value(nullValue()));

        DocumentContext json = home(user, BASE_LAT, BASE_LNG);
        Map<String, Object> treasureRecommend = recommendOf(json, "TREASURE");
        assertThat(treasureRecommend).containsOnlyKeys("missionId", "missionType", "missionTitle", "locationTitle",
                "location", "distanceMeter", "durationMinutes");
        assertThat(missionId(treasureRecommend)).isEqualTo(treasure.getMissionId());
        assertThat(treasureRecommend.get("missionTitle")).isEqualTo(missionType(MissionTypeCode.TREASURE).getTitle());
        assertThat(treasureRecommend.get("locationTitle")).isEqualTo("보물 장소");
        @SuppressWarnings("unchecked")
        Map<String, Object> location = (Map<String, Object>) treasureRecommend.get("location");
        assertThat(location).containsOnlyKeys("lat", "lng");
        assertThat(treasureRecommend.get("distanceMeter")).isEqualTo(300);
        assertThat(treasureRecommend.get("durationMinutes")).isEqualTo(4);
        assertThat(missionId(recommendOf(json, "COOPERATIVE"))).isEqualTo(cooperative.getMissionId());

        Map<String, Object> cultureRecommend = recommendOf(json, "CULTURE");
        assertThat(cultureRecommend).containsKeys("locationTitle", "location", "distanceMeter", "durationMinutes");
        assertThat(cultureRecommend.get("location")).isNull();

        Map<String, Object> progress = progressOf(json, "TREASURE").getFirst();
        assertThat(progress).containsOnlyKeys("missionId", "missionType", "missionTitle", "locationTitle",
                "distanceMeter", "durationMinutes", "totalStep", "currentStep");
        assertThat(missionId(progress)).isEqualTo(progressing.getMissionId());
        assertThat(progress.get("distanceMeter")).isEqualTo(900);
        assertThat(progress.get("durationMinutes")).isEqualTo(12);
        assertThat(progress.get("totalStep")).isEqualTo(4);
        assertThat(progress.get("currentStep")).isEqualTo(1);
    }

    @Test
    void 다른_사용자의_완료_기록과_진행도는_현재_사용자에게_영향을_주지_않는다() throws Exception {
        User user = saveUser("home-it@example.com");
        User other = saveUser("home-other-it@example.com");
        TreasureMission nearestTreasure = treasureMission(northOfBase("가까운 보물", 100), 3, MissionActivationStatus.ACTIVE);
        TreasureMission otherProgressing = treasureMission(northOfBase("먼 보물", 800), 3, MissionActivationStatus.ACTIVE);
        CooperativeMission nearestCooperative = cooperativeMission(northOfBase("가까운 협동", 100),
                MissionActivationStatus.ACTIVE);
        treasureProgress(other, nearestTreasure, 3, MissionProgressStatus.COMPLETED);
        treasureProgress(other, otherProgressing, 1, MissionProgressStatus.IN_PROGRESS);
        join(other, team(nearestCooperative, 3, MissionProgressStatus.COMPLETED), ParticipantStatus.ACCEPTED);
        entityManager.flush();

        DocumentContext json = home(user, BASE_LAT, BASE_LNG);

        assertThat(missionId(recommendOf(json, "TREASURE"))).isEqualTo(nearestTreasure.getMissionId());
        assertThat(missionId(recommendOf(json, "COOPERATIVE"))).isEqualTo(nearestCooperative.getMissionId());
        assertThat(progressList(json)).isEmpty();
    }

    @Test
    void 비활성_미션과_장소_없는_보물찾기_협동_미션은_추천하지_않는다() throws Exception {
        User user = saveUser("home-it@example.com");
        treasureMission(northOfBase("비활성 보물", 50), 3, MissionActivationStatus.INACTIVE);
        treasureMission(null, 3, MissionActivationStatus.ACTIVE);
        TreasureMission activeTreasure = treasureMission(northOfBase("활성 보물", 2000), 3,
                MissionActivationStatus.ACTIVE);
        cooperativeMission(northOfBase("비활성 협동", 50), MissionActivationStatus.INACTIVE);
        cooperativeMission(null, MissionActivationStatus.ACTIVE);
        CooperativeMission activeCooperative = cooperativeMission(northOfBase("활성 협동", 2000),
                MissionActivationStatus.ACTIVE);
        entityManager.flush();

        DocumentContext json = home(user, BASE_LAT, BASE_LNG);

        assertThat(missionId(recommendOf(json, "TREASURE"))).isEqualTo(activeTreasure.getMissionId());
        assertThat(missionId(recommendOf(json, "COOPERATIVE"))).isEqualTo(activeCooperative.getMissionId());
    }

    @Test
    void 완료한_보물찾기와_수락한_팀이_완료한_협동_미션은_추천하지_않는다() throws Exception {
        User user = saveUser("home-it@example.com");
        TreasureMission completedTreasure = treasureMission(northOfBase("완료 보물", 100), 3,
                MissionActivationStatus.ACTIVE);
        TreasureMission nextTreasure = treasureMission(northOfBase("다음 보물", 500), 3, MissionActivationStatus.ACTIVE);
        CooperativeMission completedCooperative = cooperativeMission(northOfBase("완료 협동", 100),
                MissionActivationStatus.ACTIVE);
        CooperativeMission nextCooperative = cooperativeMission(northOfBase("다음 협동", 500),
                MissionActivationStatus.ACTIVE);
        treasureProgress(user, completedTreasure, 3, MissionProgressStatus.COMPLETED);
        join(user, team(completedCooperative, 3, MissionProgressStatus.COMPLETED), ParticipantStatus.ACCEPTED);
        entityManager.flush();

        DocumentContext json = home(user, BASE_LAT, BASE_LNG);

        assertThat(missionId(recommendOf(json, "TREASURE"))).isEqualTo(nextTreasure.getMissionId());
        assertThat(missionId(recommendOf(json, "COOPERATIVE"))).isEqualTo(nextCooperative.getMissionId());
    }

    @Test
    void 미완료_후보_중_가장_가까운_미션을_추천한다() throws Exception {
        User user = saveUser("home-it@example.com");
        treasureMission(northOfBase("900m 보물", 900), 3, MissionActivationStatus.ACTIVE);
        TreasureMission nearestTreasure = treasureMission(northOfBase("100m 보물", 100), 3,
                MissionActivationStatus.ACTIVE);
        treasureMission(northOfBase("500m 보물", 500), 3, MissionActivationStatus.ACTIVE);
        cooperativeMission(northOfBase("700m 협동", 700), MissionActivationStatus.ACTIVE);
        CooperativeMission nearestCooperative = cooperativeMission(northOfBase("300m 협동", 300),
                MissionActivationStatus.ACTIVE);
        entityManager.flush();

        DocumentContext json = home(user, BASE_LAT, BASE_LNG);

        assertThat(missionId(recommendOf(json, "TREASURE"))).isEqualTo(nearestTreasure.getMissionId());
        assertThat(missionId(recommendOf(json, "COOPERATIVE"))).isEqualTo(nearestCooperative.getMissionId());
    }

    @Test
    void 문화_추천은_활성_문화_미션_중_하나이고_장소와_거리와_시간이_null이다() throws Exception {
        User user = saveUser("home-it@example.com");
        CultureMission inactive = cultureMission(MissionActivationStatus.INACTIVE, 1);
        entityManager.flush();
        List<Long> activeCultureIds = entityManager.createQuery(
                        "select c.missionId from CultureMission c where c.status = :status", Long.class)
                .setParameter("status", MissionActivationStatus.ACTIVE)
                .getResultList();

        Map<String, Object> culture = recommendOf(home(user, BASE_LAT, BASE_LNG), "CULTURE");

        assertThat(missionId(culture)).isIn(activeCultureIds).isNotEqualTo(inactive.getMissionId());
        assertThat(culture.get("missionTitle")).isEqualTo(missionType(MissionTypeCode.CULTURE).getTitle());
        assertThat(culture.get("locationTitle")).isNull();
        assertThat(culture.get("location")).isNull();
        assertThat(culture.get("distanceMeter")).isNull();
        assertThat(culture.get("durationMinutes")).isNull();
    }

    @Test
    void 후보가_없는_유형은_생략하고_모든_후보가_없으면_빈_추천_배열이다() throws Exception {
        User user = saveUser("home-it@example.com");
        deactivateAllMissions();

        getHome(user, BASE_LAT, BASE_LNG)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.missionRecommend").isEmpty());

        CooperativeMission cooperative = cooperativeMission(northOfBase("유일한 협동", 100),
                MissionActivationStatus.ACTIVE);
        entityManager.flush();

        List<Map<String, Object>> recommends = home(user, BASE_LAT, BASE_LNG).read("$.missionRecommend");
        assertThat(recommends).extracting(recommend -> recommend.get("missionType")).containsExactly("COOPERATIVE");
        assertThat(missionId(recommends.getFirst())).isEqualTo(cooperative.getMissionId());
    }

    @Test
    void 문화_진행은_미션별_퀴즈_수와_현재_퀴즈_인덱스를_반환한다() throws Exception {
        User user = saveUser("home-it@example.com");
        CultureMission threeQuizzes = cultureMission(MissionActivationStatus.ACTIVE, 3);
        CultureMission fiveQuizzes = cultureMission(MissionActivationStatus.ACTIVE, 5);
        CultureMission completed = cultureMission(MissionActivationStatus.ACTIVE, 2);
        cultureProgress(user, threeQuizzes, 2, MissionProgressStatus.IN_PROGRESS);
        cultureProgress(user, fiveQuizzes, 4, MissionProgressStatus.IN_PROGRESS);
        cultureProgress(user, completed, 2, MissionProgressStatus.COMPLETED);
        entityManager.flush();

        List<Map<String, Object>> cultures = progressOf(home(user, BASE_LAT, BASE_LNG), "CULTURE");

        assertThat(cultures).extracting(this::missionId, culture -> culture.get("totalStep"),
                        culture -> culture.get("currentStep"))
                .containsExactlyInAnyOrder(
                        tuple(threeQuizzes.getMissionId(), 3, 2),
                        tuple(fiveQuizzes.getMissionId(), 5, 4));
    }

    @Test
    void 보물찾기_진행은_전체_보물_수와_사용자가_찾은_보물_수를_반환한다() throws Exception {
        User user = saveUser("home-it@example.com");
        User other = saveUser("home-other-it@example.com");
        TreasureMission treasure = treasureMission(northOfBase("보물 장소", 300), 5, MissionActivationStatus.ACTIVE);
        treasureProgress(user, treasure, 2, MissionProgressStatus.IN_PROGRESS);
        treasureProgress(other, treasure, 4, MissionProgressStatus.IN_PROGRESS);
        entityManager.flush();

        List<Map<String, Object>> treasures = progressOf(home(user, BASE_LAT, BASE_LNG), "TREASURE");

        assertThat(treasures).hasSize(1);
        assertThat(treasures.getFirst().get("totalStep")).isEqualTo(5);
        assertThat(treasures.getFirst().get("currentStep")).isEqualTo(2);
    }

    @Test
    void 협동_진행은_현재_사용자가_참가한_진행_중_팀만_조회하고_완료_팀은_제외한다() throws Exception {
        User user = saveUser("home-it@example.com");
        CooperativeMission progressing = cooperativeMission(northOfBase("진행 협동", 300),
                MissionActivationStatus.ACTIVE);
        CooperativeMission completed = cooperativeMission(northOfBase("완료 협동", 400),
                MissionActivationStatus.ACTIVE);
        join(user, team(progressing, 1, MissionProgressStatus.IN_PROGRESS), ParticipantStatus.ACCEPTED);
        join(user, team(completed, 3, MissionProgressStatus.COMPLETED), ParticipantStatus.ACCEPTED);
        entityManager.flush();

        assertThat(progressOf(home(user, BASE_LAT, BASE_LNG), "COOPERATIVE")).extracting(this::missionId)
                .containsExactly(progressing.getMissionId());
    }

    @Test
    void 참가자에게_역할_기록이_여러_개여도_같은_팀_진행도는_한_번만_나온다() throws Exception {
        User user = saveUser("home-it@example.com");
        CooperativeMission cooperative = cooperativeMission(northOfBase("협동 장소", 300),
                MissionActivationStatus.ACTIVE);
        CooperativeMissionParticipant participant = join(user,
                team(cooperative, 2, MissionProgressStatus.IN_PROGRESS), ParticipantStatus.ACCEPTED);
        List<CooperativeRoleCard> roleCards = roleCards(2);
        roleProgress(participant, roleCards.get(0), MissionProgressStatus.IN_PROGRESS);
        roleProgress(participant, roleCards.get(1), MissionProgressStatus.COMPLETED);
        entityManager.flush();

        assertThat(progressOf(home(user, BASE_LAT, BASE_LNG), "COOPERATIVE")).hasSize(1);
    }

    @Test
    void 협동_단계는_개인_역할_상태가_아닌_팀_단계와_미션_유형의_단계_수를_사용한다() throws Exception {
        User user = saveUser("home-it@example.com");
        CooperativeMission cooperative = cooperativeMission(northOfBase("협동 장소", 300),
                MissionActivationStatus.ACTIVE);
        CooperativeMissionParticipant participant = join(user,
                team(cooperative, 2, MissionProgressStatus.IN_PROGRESS), ParticipantStatus.ACCEPTED);
        roleProgress(participant, roleCards(1).getFirst(), MissionProgressStatus.COMPLETED);
        entityManager.flush();

        Map<String, Object> progress = progressOf(home(user, BASE_LAT, BASE_LNG), "COOPERATIVE").getFirst();

        assertThat(progress.get("currentStep")).isEqualTo(2);
        assertThat(progress.get("totalStep"))
                .isEqualTo(missionType(MissionTypeCode.COOPERATIVE).getSteps().size());
    }

    @Test
    void 장소가_있으면_정수_거리와_시간을_장소가_없으면_null을_반환한다() throws Exception {
        User user = saveUser("home-it@example.com");
        TreasureMission located = treasureMission(northOfBase("300m 보물", 300), 3, MissionActivationStatus.ACTIVE);
        TreasureMission noLocation = treasureMission(null, 3, MissionActivationStatus.ACTIVE);
        CultureMission culture = cultureMission(MissionActivationStatus.ACTIVE, 1);
        treasureProgress(user, located, 1, MissionProgressStatus.IN_PROGRESS);
        treasureProgress(user, noLocation, 1, MissionProgressStatus.IN_PROGRESS);
        cultureProgress(user, culture, 1, MissionProgressStatus.IN_PROGRESS);
        entityManager.flush();

        DocumentContext json = home(user, BASE_LAT, BASE_LNG);

        Map<String, Object> locatedProgress = progressById(json, located.getMissionId());
        assertThat(locatedProgress.get("distanceMeter")).isInstanceOf(Integer.class).isEqualTo(300);
        assertThat(locatedProgress.get("durationMinutes")).isInstanceOf(Integer.class).isEqualTo(4);
        for (Long missionId : List.of(noLocation.getMissionId(), culture.getMissionId())) {
            Map<String, Object> progress = progressById(json, missionId);
            assertThat(progress.get("locationTitle")).isNull();
            assertThat(progress.get("distanceMeter")).isNull();
            assertThat(progress.get("durationMinutes")).isNull();
        }
    }

    @Test
    void 여러_사용자의_일반_길바닥_방명록을_중복_없이_전체_개수로_집계한다() throws Exception {
        User user = saveUser("home-it@example.com");
        User other = saveUser("home-other-it@example.com");
        long before = ((Number) home(user, BASE_LAT, BASE_LNG).read("$.guestbookCount")).longValue();

        locationGuestbook(user);
        roadGuestbook(other);
        entityManager.flush();

        long after = ((Number) home(user, BASE_LAT, BASE_LNG).read("$.guestbookCount")).longValue();
        assertThat(after).isEqualTo(before + 2);
    }

    @Test
    void 온보딩_결과의_이미지를_반환하고_결과가_없으면_null이다() throws Exception {
        OnboardingResult normalResult = onboardingResult("제주 사진작가");
        OnboardingResult defaultResult = onboardingResult("여행자");
        User normal = saveUser("home-normal-it@example.com");
        normal.assignOnboardingResult(normalResult);
        User skipped = saveUser("home-skipped-it@example.com");
        skipped.assignOnboardingResult(defaultResult);
        User none = saveUser("home-none-it@example.com");
        entityManager.flush();

        getHome(normal, BASE_LAT, BASE_LNG)
                .andExpect(jsonPath("$.characterImgUrl").value(normalResult.getProfileImgUrl()));
        getHome(skipped, BASE_LAT, BASE_LNG)
                .andExpect(jsonPath("$.characterImgUrl").value(defaultResult.getProfileImgUrl()));
        getHome(none, BASE_LAT, BASE_LNG)
                .andExpect(jsonPath("$.characterImgUrl").value(nullValue()));
    }

    @Test
    void 진행_기록이_없으면_빈_진행_배열을_반환한다() throws Exception {
        User user = saveUser("home-it@example.com");

        getHome(user, BASE_LAT, BASE_LNG)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.progressMission").isArray())
                .andExpect(jsonPath("$.progressMission").isEmpty());
    }

    @Test
    void 위도_경도_누락_숫자가_아닌_값_범위_초과는_400_INVALID_REQUEST() throws Exception {
        User user = saveUser("home-it@example.com");
        List<Map<String, String>> invalidQueries = List.of(
                Map.of("longitude", "10.0"),                         // 위도 누락
                Map.of("latitude", "10.0"),                          // 경도 누락
                Map.of("latitude", "abc", "longitude", "10.0"),      // 숫자가 아닌 위도
                Map.of("latitude", "10.0", "longitude", "abc"),      // 숫자가 아닌 경도
                Map.of("latitude", "90.1", "longitude", "10.0"),
                Map.of("latitude", "-90.1", "longitude", "10.0"),
                Map.of("latitude", "10.0", "longitude", "180.1"),
                Map.of("latitude", "10.0", "longitude", "-180.1"));

        for (Map<String, String> query : invalidQueries) {
            MockHttpServletRequestBuilder request = get(URL).header("Authorization", bearer(user));
            query.forEach(request::param);
            mockMvc.perform(request)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                    .andExpect(jsonPath("$.message").value("요청값이 올바르지 않습니다."));
        }
    }

    @Test
    void 토큰_없음_변조_만료는_각각_명세의_401_응답을_반환한다() throws Exception {
        User user = saveUser("home-it@example.com");
        Clock anHourAgo = Clock.offset(Clock.systemDefaultZone(), Duration.ofHours(-1));
        String expired = new JwtTokenProvider(jwtSigningKey, jwtProperties, anHourAgo).createAccessToken(user).value();

        mockMvc.perform(get(URL).param("latitude", "10.0").param("longitude", "10.0"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("인증이 필요합니다."));
        mockMvc.perform(get(URL).param("latitude", "10.0").param("longitude", "10.0")
                        .header("Authorization", bearer(user) + "a"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"))
                .andExpect(jsonPath("$.message").value("유효하지 않은 토큰입니다."));
        mockMvc.perform(get(URL).param("latitude", "10.0").param("longitude", "10.0")
                        .header("Authorization", "Bearer " + expired))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("EXPIRED_TOKEN"))
                .andExpect(jsonPath("$.message").value("만료된 토큰입니다."));
    }

    @Test
    void 토큰의_사용자가_DB에_없으면_401_UNAUTHORIZED() throws Exception {
        User ghost = User.builder()
                .email("ghost-it@example.com")
                .passwordHash("{bcrypt-hash}")
                .build();
        ReflectionTestUtils.setField(ghost, "id", 999_999_999L);

        getHome(ghost, BASE_LAT, BASE_LNG)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("인증이 필요합니다."));
    }

    @Test
    void 조회_중_예기치_않은_실패는_500_공통_응답이고_내부_메시지를_노출하지_않는다() throws Exception {
        User user = saveUser("home-it@example.com");
        doThrow(new IllegalStateException("내부 비밀 메시지")).when(guestbookCounter).countAll();

        String body = getHome(user, BASE_LAT, BASE_LNG)
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_SERVER_ERROR"))
                .andExpect(jsonPath("$.message").value("서버 내부 오류가 발생했습니다."))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        assertThat(body).doesNotContain("내부 비밀 메시지");
    }

    @Test
    void 위치를_바꾸면_새_위치_기준으로_추천과_거리_시간을_구성한다() throws Exception {
        User user = saveUser("home-it@example.com");
        TreasureMission nearBase = treasureMission(northOf("기준 근처 보물", BASE_LAT, BASE_LNG, 100), 3,
                MissionActivationStatus.ACTIVE);
        TreasureMission nearOther = treasureMission(northOf("다른 위치 근처 보물", 20.0, 20.0, 300), 3,
                MissionActivationStatus.ACTIVE);
        entityManager.flush();

        Map<String, Object> fromBase = recommendOf(home(user, BASE_LAT, BASE_LNG), "TREASURE");
        Map<String, Object> fromOther = recommendOf(home(user, 20.0, 20.0), "TREASURE");

        assertThat(missionId(fromBase)).isEqualTo(nearBase.getMissionId());
        assertThat(fromBase.get("distanceMeter")).isEqualTo(100);
        assertThat(missionId(fromOther)).isEqualTo(nearOther.getMissionId());
        assertThat(fromOther.get("distanceMeter")).isEqualTo(300);
        assertThat(fromOther.get("durationMinutes")).isEqualTo(4);
    }

    @Test
    void 반복_조회해도_사용자_진행도_방명록_온보딩_상태와_행_개수가_바뀌지_않는다() throws Exception {
        User user = saveUser("home-it@example.com");
        OnboardingResult onboardingResult = onboardingResult("제주 사진작가");
        user.assignOnboardingResult(onboardingResult);
        TreasureMission treasure = treasureMission(northOfBase("보물 장소", 300), 5, MissionActivationStatus.ACTIVE);
        TreasureMissionProgress treasureProgress = treasureProgress(user, treasure, 2,
                MissionProgressStatus.IN_PROGRESS);
        CooperativeMissionProgress team = team(cooperativeMission(northOfBase("협동 장소", 400),
                MissionActivationStatus.ACTIVE), 2, MissionProgressStatus.IN_PROGRESS);
        join(user, team, ParticipantStatus.ACCEPTED);
        cultureProgress(user, cultureMission(MissionActivationStatus.ACTIVE, 3), 2, MissionProgressStatus.IN_PROGRESS);
        locationGuestbook(user);
        flushAndClear();
        Map<String, Long> before = rowCounts();

        for (int i = 0; i < 3; i++) {
            getHome(user, BASE_LAT, BASE_LNG).andExpect(status().isOk());
        }
        flushAndClear();

        assertThat(rowCounts()).isEqualTo(before);
        assertThat(entityManager.find(User.class, user.getId()).getOnboardingResult().getId())
                .isEqualTo(onboardingResult.getId());
        TreasureMissionProgress reloadedTreasure = entityManager.find(TreasureMissionProgress.class,
                treasureProgress.getId());
        assertThat(reloadedTreasure.getFoundItemCount()).isEqualTo(2);
        assertThat(reloadedTreasure.getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        CooperativeMissionProgress reloadedTeam = entityManager.find(CooperativeMissionProgress.class, team.getId());
        assertThat(reloadedTeam.getCurrentStep()).isEqualTo(2);
        assertThat(reloadedTeam.getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
    }

    // ---------------------------------------------------------------- 요청·응답 도우미

    private ResultActions getHome(User user, double latitude, double longitude) throws Exception {
        return mockMvc.perform(get(URL)
                .param("latitude", String.valueOf(latitude))
                .param("longitude", String.valueOf(longitude))
                .header("Authorization", bearer(user)));
    }

    /** 홈을 조회해 200을 확인하고 응답 JSON을 돌려준다. */
    private DocumentContext home(User user, double latitude, double longitude) throws Exception {
        String body = getHome(user, latitude, longitude)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return JsonPath.parse(body);
    }

    private String bearer(User user) {
        return "Bearer " + jwtTokenProvider.createAccessToken(user).value();
    }

    /** 추천 목록에서 유형으로 항목을 찾는다. 목록 순서는 계약이 아니므로 순서에 의존하지 않는다. */
    private static Map<String, Object> recommendOf(DocumentContext json, String missionType) {
        List<Map<String, Object>> recommends = json.read("$.missionRecommend");
        return recommends.stream()
                .filter(recommend -> missionType.equals(recommend.get("missionType")))
                .findFirst()
                .orElseThrow(() -> new AssertionError(missionType + " 추천이 없습니다: " + recommends));
    }

    private static List<Map<String, Object>> progressList(DocumentContext json) {
        return json.read("$.progressMission");
    }

    private static List<Map<String, Object>> progressOf(DocumentContext json, String missionType) {
        return progressList(json).stream()
                .filter(progress -> missionType.equals(progress.get("missionType")))
                .toList();
    }

    private Map<String, Object> progressById(DocumentContext json, Long missionId) {
        return progressList(json).stream()
                .filter(progress -> missionId(progress).equals(missionId))
                .findFirst()
                .orElseThrow(() -> new AssertionError(missionId + " 진행 미션이 없습니다."));
    }

    private Long missionId(Map<String, Object> item) {
        return ((Number) item.get("missionId")).longValue();
    }

    // ---------------------------------------------------------------- 테스트 데이터 도우미

    private User saveUser(String email) {
        return userRepository.saveAndFlush(User.builder()
                .email(email)
                .passwordHash("{bcrypt-hash}")
                .nickname("몽글몽글파도")
                .build());
    }

    private MissionType missionType(MissionTypeCode code) {
        return entityManager.createQuery("select t from MissionType t where t.type = :type", MissionType.class)
                .setParameter("type", code)
                .getSingleResult();
    }

    private OnboardingResult onboardingResult(String userType) {
        return entityManager.createQuery(
                        "select r from OnboardingResult r where r.userType = :userType order by r.id", OnboardingResult.class)
                .setParameter("userType", userType)
                .setMaxResults(1)
                .getSingleResult();
    }

    private Mission mission(MissionTypeCode code) {
        Mission mission = Mission.builder().missionType(missionType(code)).build();
        entityManager.persist(mission);
        return mission;
    }

    /** 요청 기준 위치에서 정북으로 지정 거리(m)만큼 떨어진 장소를 만든다. */
    private Location northOfBase(String title, double meters) {
        return northOf(title, BASE_LAT, BASE_LNG, meters);
    }

    private Location northOf(String title, double latitude, double longitude, double meters) {
        Location location = Location.builder()
                .contentId(CONTENT_ID.incrementAndGet())
                .title(title)
                .address(title + " 주소")
                .category("관광지")
                .radius(50)
                .latitude(latitude + meters / METER_PER_LATITUDE_DEGREE)
                .longitude(longitude)
                .build();
        entityManager.persist(location);
        return location;
    }

    private TreasureMission treasureMission(Location location, int itemTotalCount, MissionActivationStatus status) {
        TreasureMission treasureMission = TreasureMission.builder()
                .mission(mission(MissionTypeCode.TREASURE))
                .location(location)
                .itemTotalCount(itemTotalCount)
                .status(status)
                .build();
        entityManager.persist(treasureMission);
        entityManager.flush();
        return treasureMission;
    }

    private CooperativeMission cooperativeMission(Location location, MissionActivationStatus status) {
        CooperativeMission cooperativeMission = CooperativeMission.builder()
                .mission(mission(MissionTypeCode.COOPERATIVE))
                .location(location)
                .status(status)
                .build();
        entityManager.persist(cooperativeMission);
        entityManager.flush();
        return cooperativeMission;
    }

    /** 퀴즈를 지정 개수만큼 가진 문화 미션을 만든다. */
    private CultureMission cultureMission(MissionActivationStatus status, int quizCount) {
        CultureMission cultureMission = CultureMission.builder()
                .mission(mission(MissionTypeCode.CULTURE))
                .status(status)
                .build();
        entityManager.persist(cultureMission);
        entityManager.flush();
        for (int quizIndex = 1; quizIndex <= quizCount; quizIndex++) {
            entityManager.persist(CultureMissionQuiz.builder()
                    .cultureMission(cultureMission)
                    .quizIndex(quizIndex)
                    .question("문제 " + quizIndex)
                    .answer("정답")
                    .build());
        }
        return cultureMission;
    }

    private TreasureMissionProgress treasureProgress(User user, TreasureMission treasureMission,
                                                     int foundItemCount, MissionProgressStatus status) {
        TreasureMissionProgress progress = TreasureMissionProgress.builder()
                .user(user)
                .treasureMission(treasureMission)
                .foundItemCount(foundItemCount)
                .missionStatus(status)
                .build();
        entityManager.persist(progress);
        return progress;
    }

    private void cultureProgress(User user, CultureMission cultureMission, int currentQuizIndex,
                                 MissionProgressStatus status) {
        entityManager.persist(CultureMissionProgress.builder()
                .user(user)
                .cultureMission(cultureMission)
                .currentQuizIndex(currentQuizIndex)
                .missionStatus(status)
                .build());
    }

    private CooperativeMissionProgress team(CooperativeMission cooperativeMission, int currentStep,
                                            MissionProgressStatus status) {
        CooperativeMissionProgress progress = CooperativeMissionProgress.builder()
                .cooperativeMission(cooperativeMission)
                .currentStep(currentStep)
                .missionStatus(status)
                .teamToken(UUID.randomUUID().toString())
                .build();
        entityManager.persist(progress);
        return progress;
    }

    private CooperativeMissionParticipant join(User user, CooperativeMissionProgress team,
                                               ParticipantStatus participantStatus) {
        CooperativeMissionParticipant participant = CooperativeMissionParticipant.builder()
                .user(user)
                .cooperativeMissionProgress(team)
                .participantStatus(participantStatus)
                .participantRole(ParticipantRole.MEMBER)
                .build();
        entityManager.persist(participant);
        return participant;
    }

    private List<CooperativeRoleCard> roleCards(int count) {
        return entityManager.createQuery("select c from CooperativeRoleCard c order by c.id", CooperativeRoleCard.class)
                .setMaxResults(count)
                .getResultList();
    }

    private void roleProgress(CooperativeMissionParticipant participant, CooperativeRoleCard roleCard,
                              MissionProgressStatus status) {
        entityManager.persist(CooperativeMissionRoleProgress.builder()
                .participant(participant)
                .roleCard(roleCard)
                .progressStatus(status)
                .build());
    }

    private Guestbook guestbook(User user) {
        Guestbook guestbook = Guestbook.builder()
                .user(user)
                .visitedAt(LocalDate.of(2026, 10, 1))
                .contentWriting("즐거운 여행")
                .savedAt(LocalDateTime.of(2026, 10, 1, 12, 0))
                .status(GuestbookStatus.ACTIVE)
                .build();
        entityManager.persist(guestbook);
        entityManager.flush();
        return guestbook;
    }

    private void locationGuestbook(User user) {
        entityManager.persist(LocationGuestbook.builder().guestbook(guestbook(user)).build());
    }

    private void roadGuestbook(User user) {
        entityManager.persist(RoadGuestbook.builder()
                .guestbook(guestbook(user))
                .locationAlias("우리 동네 길")
                .latitude(BASE_LAT)
                .longitude(BASE_LNG)
                .build());
    }

    /** 기존 문화·협동·보물찾기 미션을 모두 비활성으로 바꾼다. 테스트가 끝나면 롤백된다. */
    private void deactivateAllMissions() {
        for (String entity : List.of("CultureMission", "TreasureMission", "CooperativeMission")) {
            entityManager.createQuery("update " + entity + " m set m.status = :status")
                    .setParameter("status", MissionActivationStatus.INACTIVE)
                    .executeUpdate();
        }
        entityManager.clear();
    }

    /** 영속성 컨텍스트를 비워 이후 조회가 실제 DB 값을 읽도록 한다. */
    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }

    /** 홈 조회가 바꾸면 안 되는 테이블들의 현재 행 개수 */
    private Map<String, Long> rowCounts() {
        return Map.of(
                "User", count("User"),
                "TreasureMissionProgress", count("TreasureMissionProgress"),
                "CooperativeMissionProgress", count("CooperativeMissionProgress"),
                "CooperativeMissionParticipant", count("CooperativeMissionParticipant"),
                "CultureMissionProgress", count("CultureMissionProgress"),
                "Guestbook", count("Guestbook"));
    }

    private long count(String entity) {
        return entityManager.createQuery("select count(e) from " + entity + " e", Long.class).getSingleResult();
    }
}
