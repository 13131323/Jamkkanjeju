package com.jamkkanjeju.server.domain.culturemission.integration;

import com.jamkkanjeju.server.support.MySqlIntegrationTestSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jamkkanjeju.server.domain.auth.config.JwtProperties;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionQuiz;
import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatusId;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionQuizRepository;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionType;
import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * POST /api/v2/culture-missions/{missionId}/progress 를 실제 HTTP 요청 흐름(JWT 필터 → 컨트롤러 → 서비스 → MySQL)으로 검증한다.
 * 테스트마다 사용자·문화 미션·퀴즈·진행도를 새로 만들고, 미션 유형과 AR 캐릭터만 Flyway 초기 데이터를 쓴다.
 * 각 테스트는 끝나면 롤백된다. (실제 롤백을 확인하는 두 테스트만 트랜잭션 없이 실행하고 데이터를 직접 정리한다)
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
class StartCultureMissionApiIntegrationTest extends MySqlIntegrationTestSupport {

    private static final String URL = "/api/v2/culture-missions/{missionId}/progress";
    private static final LocalDateTime LAST_COMPLETED_AT = LocalDateTime.of(2026, 10, 1, 12, 0);

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
    @Autowired
    private TransactionTemplate transactionTemplate;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @MockitoSpyBean
    private CultureMissionQuizRepository cultureMissionQuizRepository;

    @Test
    void 처음_시작하면_201이고_응답_진행도_ID가_DB에_생성된_ID와_같다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.ACTIVE, 3);

        Long responseId = progressId(start(user, mission.getMissionId()).andExpect(status().isCreated()));
        flushAndClear();

        assertThat(responseId).isEqualTo(findProgress(user, mission).getId());
    }

    @Test
    void 처음_시작하면_사용자와_미션에_연결된_진행_중_1번_퀴즈_정답_0개_완료_시각_없음으로_저장된다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.ACTIVE, 3);

        start(user, mission.getMissionId()).andExpect(status().isCreated());
        flushAndClear();

        CultureMissionProgress saved = findProgress(user, mission);
        assertThat(saved.getUser().getId()).isEqualTo(user.getId());
        assertThat(saved.getCultureMission().getMissionId()).isEqualTo(mission.getMissionId());
        assertThat(saved.getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        assertThat(saved.getCurrentQuizIndex()).isEqualTo(1);
        assertThat(saved.getCorrectCount()).isZero();
        assertThat(saved.getLastCompletedAt()).isNull();
    }

    @Test
    void 진행_중이면_200이고_ID_퀴즈_번호_정답_수_마지막_완료_시각이_그대로다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.ACTIVE, 3);
        CultureMissionProgress progress = progress(user, mission, MissionProgressStatus.IN_PROGRESS, 2, 1,
                LAST_COMPLETED_AT);
        flushAndClear();

        start(user, mission.getMissionId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cultureMissionProgressId").value(progress.getId()))
                .andExpect(jsonPath("$.currentQuizNumber").value(2));
        flushAndClear();

        assertProgress(progress.getId(), MissionProgressStatus.IN_PROGRESS, 2, 1, LAST_COMPLETED_AT);
    }

    @Test
    void 완료했으면_200이고_같은_ID로_초기화되며_마지막_완료_시각은_유지된다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.ACTIVE, 3);
        CultureMissionProgress progress = progress(user, mission, MissionProgressStatus.COMPLETED, 3, 3,
                LAST_COMPLETED_AT);
        flushAndClear();

        start(user, mission.getMissionId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cultureMissionProgressId").value(progress.getId()))
                .andExpect(jsonPath("$.currentQuizNumber").value(1));
        flushAndClear();

        assertProgress(progress.getId(), MissionProgressStatus.IN_PROGRESS, 1, 0, LAST_COMPLETED_AT);
    }

    @Test
    void 재시작해도_보상_지급_이력은_초기화되거나_삭제되지_않는다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.ACTIVE, 3);
        progress(user, mission, MissionProgressStatus.COMPLETED, 3, 3, LAST_COMPLETED_AT);
        MissionRewardStatus reward = MissionRewardStatus.builder().user(user).mission(mission.getMission()).build();
        reward.grantArCharacterReward();
        reward.grantPointReward();
        reward.grantCouponReward();
        entityManager.persist(reward);
        flushAndClear();

        start(user, mission.getMissionId()).andExpect(status().isOk());
        flushAndClear();

        MissionRewardStatus reloaded = entityManager.find(MissionRewardStatus.class,
                new MissionRewardStatusId(mission.getMissionId(), user.getId()));
        assertThat(reloaded).isNotNull();
        assertThat(reloaded.isArCharacterRewardGranted()).isTrue();
        assertThat(reloaded.isPointRewardGranted()).isTrue();
        assertThat(reloaded.isCouponRewardGranted()).isTrue();
    }

    @Test
    void 시작_이어하기_재시작은_포인트와_AR_캐릭터와_쿠폰을_지급하지_않는다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.ACTIVE, 3);
        flushAndClear();
        long arCharacters = count("select count(a) from AcquiredArCharacter a where a.user.id = :userId", user);
        long coupons = count("select count(c) from AcquiredCoupon c where c.user.id = :userId", user);

        start(user, mission.getMissionId()).andExpect(status().isCreated());
        start(user, mission.getMissionId()).andExpect(status().isOk());
        flushAndClear();
        findProgress(user, mission).complete(LAST_COMPLETED_AT);
        flushAndClear();
        start(user, mission.getMissionId()).andExpect(status().isOk());
        flushAndClear();

        assertThat(entityManager.find(User.class, user.getId()).getPoint()).isZero();
        assertThat(count("select count(a) from AcquiredArCharacter a where a.user.id = :userId", user))
                .isEqualTo(arCharacters);
        assertThat(count("select count(c) from AcquiredCoupon c where c.user.id = :userId", user)).isEqualTo(coupons);
    }

    @Test
    void 처음_요청은_201_이후_요청은_200이고_같은_진행도_한_건만_유지된다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.ACTIVE, 3);

        Long first = progressId(start(user, mission.getMissionId()).andExpect(status().isCreated()));
        Long second = progressId(start(user, mission.getMissionId()).andExpect(status().isOk()));
        Long third = progressId(start(user, mission.getMissionId()).andExpect(status().isOk()));
        flushAndClear();

        assertThat(List.of(second, third)).containsOnly(first);
        assertThat(progressCount(user, mission)).isEqualTo(1);
    }

    @Test
    void 재시작한_뒤_진행한_퀴즈_번호와_정답_수는_다시_호출해도_초기화되지_않는다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.ACTIVE, 3);
        CultureMissionProgress progress = progress(user, mission, MissionProgressStatus.COMPLETED, 3, 3,
                LAST_COMPLETED_AT);
        flushAndClear();
        start(user, mission.getMissionId()).andExpect(status().isOk());
        flushAndClear();
        CultureMissionProgress restarted = entityManager.find(CultureMissionProgress.class, progress.getId());
        restarted.moveToNextQuiz(true);
        restarted.moveToNextQuiz(true);
        flushAndClear();

        start(user, mission.getMissionId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentQuizNumber").value(3));
        flushAndClear();

        assertProgress(progress.getId(), MissionProgressStatus.IN_PROGRESS, 3, 2, LAST_COMPLETED_AT);
    }

    @Test
    void 다른_사용자의_진행도가_있어도_현재_사용자의_진행도를_새로_만들고_타인_기록은_바꾸지_않는다() throws Exception {
        User user = saveUser("cm-it@example.com");
        User other = saveUser("cm-other-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.ACTIVE, 3);
        CultureMissionProgress othersProgress = progress(other, mission, MissionProgressStatus.COMPLETED, 3, 3,
                LAST_COMPLETED_AT);
        flushAndClear();

        Long created = progressId(start(user, mission.getMissionId()).andExpect(status().isCreated()));
        flushAndClear();

        assertThat(created).isNotEqualTo(othersProgress.getId());
        assertProgress(othersProgress.getId(), MissionProgressStatus.COMPLETED, 3, 3, LAST_COMPLETED_AT);
    }

    @Test
    void 같은_사용자의_다른_문화_미션_진행도는_바꾸지_않는다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission requested = cultureMission(MissionActivationStatus.ACTIVE, 3);
        CultureMission other = cultureMission(MissionActivationStatus.ACTIVE, 3);
        CultureMissionProgress otherProgress = progress(user, other, MissionProgressStatus.COMPLETED, 3, 3,
                LAST_COMPLETED_AT);
        flushAndClear();

        start(user, requested.getMissionId()).andExpect(status().isCreated());
        flushAndClear();

        assertProgress(otherProgress.getId(), MissionProgressStatus.COMPLETED, 3, 3, LAST_COMPLETED_AT);
    }

    @Test
    void 퀴즈는_번호_오름차순이고_quizCount는_요청한_미션의_퀴즈_수다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMissionWithQuizOrder(MissionActivationStatus.ACTIVE, List.of(3, 1, 2));
        cultureMission(MissionActivationStatus.ACTIVE, 5);
        flushAndClear();

        start(user, mission.getMissionId())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.quizCount").value(3))
                .andExpect(jsonPath("$.quizDetails[*].quizIndex").value(org.hamcrest.Matchers.contains(1, 2, 3)));
    }

    @Test
    void 명세의_필드와_문제_상세를_반환하고_내부_값인_created는_노출하지_않는다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.ACTIVE, 1);
        flushAndClear();

        Map<String, Object> body = JsonPath.parse(responseBody(start(user, mission.getMissionId())
                .andExpect(status().isCreated()))).read("$");

        assertThat(body).containsOnlyKeys("cultureMissionProgressId", "quizCount", "currentQuizNumber", "quizDetails");
        List<Map<String, Object>> details = JsonPath.parse(body).read("$.quizDetails");
        // 정답(answer)과 해설(explanation)은 진행도 저장 API의 채점 응답에서만 제공한다.
        assertThat(details.getFirst()).containsOnlyKeys("quizIndex", "imgUrl", "question", "options", "hint");
        assertThat(details.getFirst().get("question")).isEqualTo("객관식 문제 1");
        assertThat(details.getFirst().get("options")).isEqualTo(List.of("하르방", "하라범", "하르봉", "하르범"));
        assertThat(details.getFirst().get("hint")).isEqualTo("힌트 1");
    }

    @Test
    void 주관식_선택지와_없는_이미지_힌트는_필드를_빼지_않고_null로_반환한다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.ACTIVE, 0);
        shortAnswerQuiz(mission, 1);
        flushAndClear();

        Map<String, Object> detail = JsonPath.parse(responseBody(start(user, mission.getMissionId())
                .andExpect(status().isCreated()))).read("$.quizDetails[0]");

        assertThat(detail).containsKeys("options", "imgUrl", "hint");
        assertThat(detail.get("options")).isNull();
        assertThat(detail.get("imgUrl")).isNull();
        assertThat(detail.get("hint")).isNull();
    }

    @Test
    void 정수로_바꿀_수_없는_missionId는_400_INVALID_REQUEST() throws Exception {
        User user = saveUser("cm-it@example.com");

        mockMvc.perform(post("/api/v2/culture-missions/abc/progress").header("Authorization", bearer(user)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.message").value("요청값이 올바르지 않습니다."));
    }

    @Test
    void 토큰_없이_호출하면_401_UNAUTHORIZED이고_진행도가_생기지_않는다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.ACTIVE, 3);
        flushAndClear();

        mockMvc.perform(post(URL, mission.getMissionId()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("인증이 필요합니다."));

        assertThat(progressCount(user, mission)).isZero();
        assertThat(count("select count(p) from CultureMissionProgress p where p.cultureMission.missionId = "
                + mission.getMissionId(), null)).isZero();
    }

    @Test
    void 변조된_토큰이면_401_INVALID_TOKEN이고_진행도가_바뀌지_않는다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.ACTIVE, 3);
        CultureMissionProgress progress = progress(user, mission, MissionProgressStatus.COMPLETED, 3, 3,
                LAST_COMPLETED_AT);
        flushAndClear();

        mockMvc.perform(post(URL, mission.getMissionId()).header("Authorization", bearer(user) + "a"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"))
                .andExpect(jsonPath("$.message").value("유효하지 않은 토큰입니다."));
        flushAndClear();

        assertProgress(progress.getId(), MissionProgressStatus.COMPLETED, 3, 3, LAST_COMPLETED_AT);
        assertThat(progressCount(user, mission)).isEqualTo(1);
    }

    @Test
    void 만료된_토큰이면_401_EXPIRED_TOKEN이고_진행도가_바뀌지_않는다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.ACTIVE, 3);
        CultureMissionProgress progress = progress(user, mission, MissionProgressStatus.COMPLETED, 3, 3,
                LAST_COMPLETED_AT);
        flushAndClear();
        Clock anHourAgo = Clock.offset(Clock.systemDefaultZone(), Duration.ofHours(-1));
        String expired = new JwtTokenProvider(jwtSigningKey, jwtProperties, anHourAgo).createAccessToken(user).value();

        mockMvc.perform(post(URL, mission.getMissionId()).header("Authorization", "Bearer " + expired))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("EXPIRED_TOKEN"))
                .andExpect(jsonPath("$.message").value("만료된 토큰입니다."));
        flushAndClear();

        assertProgress(progress.getId(), MissionProgressStatus.COMPLETED, 3, 3, LAST_COMPLETED_AT);
        assertThat(progressCount(user, mission)).isEqualTo(1);
    }

    @Test
    void 토큰의_사용자가_DB에_없으면_401_UNAUTHORIZED() throws Exception {
        CultureMission mission = cultureMission(MissionActivationStatus.ACTIVE, 3);
        User ghost = User.builder().email("ghost-it@example.com").passwordHash("{bcrypt-hash}").build();
        ReflectionTestUtils.setField(ghost, "id", 999_999_999L);

        start(ghost, mission.getMissionId())
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("인증이 필요합니다."));
    }

    @Test
    void 없는_ID나_문화_미션이_아닌_공통_미션_ID면_404_CULTURE_MISSION_NOT_FOUND() throws Exception {
        User user = saveUser("cm-it@example.com");
        Mission treasureOnly = mission(MissionTypeCode.TREASURE);
        flushAndClear();

        for (Long missionId : List.of(999_999_999L, treasureOnly.getId())) {
            start(user, missionId)
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.code").value("CULTURE_MISSION_NOT_FOUND"))
                    .andExpect(jsonPath("$.message").value("문화 미션을 찾을 수 없습니다."));
        }
    }

    @Test
    void 비활성_미션을_처음_시작하면_404_CULTURE_MISSION_INACTIVE이고_진행도가_생기지_않는다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.INACTIVE, 3);
        flushAndClear();

        expectInactive(user, mission);
        flushAndClear();

        assertThat(progressCount(user, mission)).isZero();
    }

    @Test
    void 비활성_미션은_진행_중_기록이_있어도_404이고_기존_기록을_유지한다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.INACTIVE, 3);
        CultureMissionProgress progress = progress(user, mission, MissionProgressStatus.IN_PROGRESS, 2, 1, null);
        flushAndClear();

        expectInactive(user, mission);
        flushAndClear();

        assertProgress(progress.getId(), MissionProgressStatus.IN_PROGRESS, 2, 1, null);
    }

    @Test
    void 비활성_미션은_완료_기록이_있어도_404이고_완료_기록을_초기화하지_않는다() throws Exception {
        User user = saveUser("cm-it@example.com");
        CultureMission mission = cultureMission(MissionActivationStatus.INACTIVE, 3);
        CultureMissionProgress progress = progress(user, mission, MissionProgressStatus.COMPLETED, 3, 3,
                LAST_COMPLETED_AT);
        flushAndClear();

        expectInactive(user, mission);
        flushAndClear();

        assertProgress(progress.getId(), MissionProgressStatus.COMPLETED, 3, 3, LAST_COMPLETED_AT);
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void 진행도_생성_뒤_퀴즈_조회가_실패하면_500이고_새_진행도가_남지_않는다() throws Exception {
        CommittedData data = commit("cm-rollback-create-it@example.com", null);
        try {
            doThrow(new IllegalStateException("내부 비밀 메시지"))
                    .when(cultureMissionQuizRepository).findAllByIdCultureMissionIdOrderByIdQuizIndexAsc(any());

            expectServerError(start(data.user(), data.missionId()));

            assertThat(jdbcTemplate.queryForObject(
                    "select count(*) from culture_mission_progress where user_id = ? and culture_mission_id = ?",
                    Long.class, data.user().getId(), data.missionId())).isZero();
        } finally {
            cleanUp(data);
        }
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void 재시작_초기화_뒤_퀴즈_조회가_실패하면_500이고_완료_기록이_그대로_남는다() throws Exception {
        CommittedData data = commit("cm-rollback-restart-it@example.com", MissionProgressStatus.COMPLETED);
        try {
            doThrow(new IllegalStateException("내부 비밀 메시지"))
                    .when(cultureMissionQuizRepository).findAllByIdCultureMissionIdOrderByIdQuizIndexAsc(any());

            expectServerError(start(data.user(), data.missionId()));

            Map<String, Object> row = jdbcTemplate.queryForMap("""
                    select id, mission_status, current_quiz_index, correct_count
                    from culture_mission_progress where user_id = ? and culture_mission_id = ?
                    """, data.user().getId(), data.missionId());
            assertThat(((Number) row.get("id")).longValue()).isEqualTo(data.progressId());
            assertThat(row.get("mission_status")).isEqualTo("COMPLETED");
            assertThat(((Number) row.get("current_quiz_index")).intValue()).isEqualTo(3);
            assertThat(((Number) row.get("correct_count")).intValue()).isEqualTo(3);
            assertThat(jdbcTemplate.queryForObject(
                    "select last_completed_at from culture_mission_progress where id = ?",
                    LocalDateTime.class, data.progressId())).isEqualTo(LAST_COMPLETED_AT);
        } finally {
            cleanUp(data);
        }
    }

    // ---------------------------------------------------------------- 요청·응답 도우미

    private ResultActions start(User user, Long missionId) throws Exception {
        return mockMvc.perform(post(URL, missionId).header("Authorization", bearer(user)));
    }

    private String bearer(User user) {
        return "Bearer " + jwtTokenProvider.createAccessToken(user).value();
    }

    private static String responseBody(ResultActions result) throws Exception {
        return result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private static Long progressId(ResultActions result) throws Exception {
        return ((Number) JsonPath.read(responseBody(result), "$.cultureMissionProgressId")).longValue();
    }

    private void expectInactive(User user, CultureMission mission) throws Exception {
        start(user, mission.getMissionId())
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CULTURE_MISSION_INACTIVE"))
                .andExpect(jsonPath("$.message").value("비활성화된 문화 미션입니다."));
    }

    private static void expectServerError(ResultActions result) throws Exception {
        String body = responseBody(result
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_SERVER_ERROR"))
                .andExpect(jsonPath("$.message").value("서버 내부 오류가 발생했습니다.")));
        assertThat(body).doesNotContain("내부 비밀 메시지");
    }

    // ---------------------------------------------------------------- 테스트 데이터 도우미

    private User saveUser(String email) {
        return userRepository.saveAndFlush(User.builder()
                .email(email)
                .passwordHash("{bcrypt-hash}")
                .nickname("몽글몽글파도")
                .build());
    }

    private Mission mission(MissionTypeCode code) {
        MissionType missionType = entityManager
                .createQuery("select t from MissionType t where t.type = :type", MissionType.class)
                .setParameter("type", code)
                .getSingleResult();
        Mission mission = Mission.builder().missionType(missionType).build();
        entityManager.persist(mission);
        return mission;
    }

    /** 객관식 퀴즈를 1번부터 지정 개수만큼 가진 문화 미션을 만든다. 보상으로 포인트와 AR 캐릭터를 건다. */
    private CultureMission cultureMission(MissionActivationStatus status, int quizCount) {
        return cultureMissionWithQuizOrder(status, java.util.stream.IntStream.rangeClosed(1, quizCount).boxed().toList());
    }

    /** 지정한 순서대로 객관식 퀴즈를 저장한 문화 미션을 만든다. */
    private CultureMission cultureMissionWithQuizOrder(MissionActivationStatus status, List<Integer> quizIndexes) {
        ArCharacter arCharacter = entityManager.createQuery("select a from ArCharacter a order by a.id", ArCharacter.class)
                .setMaxResults(1)
                .getSingleResult();
        CultureMission cultureMission = CultureMission.builder()
                .mission(mission(MissionTypeCode.CULTURE))
                .status(status)
                .arCharacter(arCharacter)
                .point(100)
                .build();
        entityManager.persist(cultureMission);
        entityManager.flush();
        for (Integer quizIndex : quizIndexes) {
            entityManager.persist(CultureMissionQuiz.builder()
                    .cultureMission(cultureMission)
                    .quizIndex(quizIndex)
                    .imgUrl("https://example.com/quiz-" + quizIndex + ".png")
                    .question("객관식 문제 " + quizIndex)
                    .options(List.of("하르방", "하라범", "하르봉", "하르범"))
                    .answer("하르방")
                    .hint("힌트 " + quizIndex)
                    .explanation("해설 " + quizIndex)
                    .build());
        }
        return cultureMission;
    }

    private void shortAnswerQuiz(CultureMission cultureMission, int quizIndex) {
        entityManager.persist(CultureMissionQuiz.builder()
                .cultureMission(cultureMission)
                .quizIndex(quizIndex)
                .question("주관식 문제 " + quizIndex)
                .answer("많이")
                .build());
    }

    private CultureMissionProgress progress(User user, CultureMission cultureMission, MissionProgressStatus status,
                                            int currentQuizIndex, int correctCount, LocalDateTime lastCompletedAt) {
        CultureMissionProgress progress = CultureMissionProgress.builder()
                .user(user)
                .cultureMission(cultureMission)
                .missionStatus(status)
                .currentQuizIndex(currentQuizIndex)
                .correctCount(correctCount)
                .lastCompletedAt(lastCompletedAt)
                .build();
        entityManager.persist(progress);
        return progress;
    }

    private CultureMissionProgress findProgress(User user, CultureMission mission) {
        return entityManager.createQuery("""
                        select p from CultureMissionProgress p
                        where p.user.id = :userId and p.cultureMission.missionId = :missionId
                        """, CultureMissionProgress.class)
                .setParameter("userId", user.getId())
                .setParameter("missionId", mission.getMissionId())
                .getSingleResult();
    }

    private long progressCount(User user, CultureMission mission) {
        return entityManager.createQuery("""
                        select count(p) from CultureMissionProgress p
                        where p.user.id = :userId and p.cultureMission.missionId = :missionId
                        """, Long.class)
                .setParameter("userId", user.getId())
                .setParameter("missionId", mission.getMissionId())
                .getSingleResult();
    }

    /** 사용자 조건이 있으면 :userId에 사용자 ID를 넣어 개수를 센다. */
    private long count(String jpql, User user) {
        var query = entityManager.createQuery(jpql, Long.class);
        if (user != null) {
            query.setParameter("userId", user.getId());
        }
        return query.getSingleResult();
    }

    private void assertProgress(Long progressId, MissionProgressStatus status, int currentQuizIndex,
                                int correctCount, LocalDateTime lastCompletedAt) {
        CultureMissionProgress progress = entityManager.find(CultureMissionProgress.class, progressId);
        assertThat(progress.getMissionStatus()).isEqualTo(status);
        assertThat(progress.getCurrentQuizIndex()).isEqualTo(currentQuizIndex);
        assertThat(progress.getCorrectCount()).isEqualTo(correctCount);
        assertThat(progress.getLastCompletedAt()).isEqualTo(lastCompletedAt);
    }

    /** 영속성 컨텍스트를 비워 이후 조회가 실제 DB 값을 읽도록 한다. */
    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }

    // ---------------------------------------------------------------- 롤백 검증용 커밋 데이터

    /** 롤백 검증 테스트가 커밋해 둔 데이터. 진행도가 없으면 progressId는 null이다. */
    private record CommittedData(User user, Long missionId, Long progressId) {
    }

    /** 사용자와 문화 미션(퀴즈 3개)을 커밋하고, 상태를 주면 그 상태의 진행도도 함께 커밋한다. */
    private CommittedData commit(String email, MissionProgressStatus progressStatus) {
        return transactionTemplate.execute(transaction -> {
            User user = saveUser(email);
            CultureMission mission = cultureMission(MissionActivationStatus.ACTIVE, 3);
            Long progressId = progressStatus == null ? null
                    : progress(user, mission, progressStatus, 3, 3, LAST_COMPLETED_AT).getId();
            entityManager.flush();
            return new CommittedData(user, mission.getMissionId(), progressId);
        });
    }

    /** 커밋한 데이터를 FK 의존 순서대로 지운다. */
    private void cleanUp(CommittedData data) {
        jdbcTemplate.update("delete from culture_mission_progress where user_id = ?", data.user().getId());
        jdbcTemplate.update("delete from culture_mission_quiz where culture_mission_id = ?", data.missionId());
        jdbcTemplate.update("delete from culture_mission where mission_id = ?", data.missionId());
        jdbcTemplate.update("delete from mission where id = ?", data.missionId());
        jdbcTemplate.update("delete from user where id = ?", data.user().getId());
    }
}
