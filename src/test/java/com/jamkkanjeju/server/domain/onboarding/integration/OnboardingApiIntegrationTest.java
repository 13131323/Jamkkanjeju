package com.jamkkanjeju.server.domain.onboarding.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.jwt.JwtTokenProvider;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.onboarding.entity.ExpectationType;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import com.jamkkanjeju.server.domain.onboarding.entity.TransportationType;
import com.jamkkanjeju.server.domain.onboarding.entity.TravelStyleType;
import com.jamkkanjeju.server.domain.onboarding.entity.UserExpectation;
import com.jamkkanjeju.server.domain.onboarding.repository.OnboardingResultRepository;
import com.jamkkanjeju.server.domain.onboarding.repository.UserExpectationRepository;
import com.jamkkanjeju.server.domain.onboarding.repository.UserTransportationRepository;
import com.jamkkanjeju.server.domain.onboarding.repository.UserTravelStyleRepository;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * PATCH /api/v2/users/me 를 실제 HTTP 요청 흐름(JWT 필터 → 컨트롤러 → 서비스 → MySQL)으로 검증한다.
 * 기준 데이터(기대 항목, 이동 수단, 여행 방식, 온보딩 결과)는 Flyway V2 초기 데이터를 쓴다.
 * 각 테스트는 트랜잭션 안에서 실행되고 끝나면 롤백된다. (롤백 검증 테스트만 예외)
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
class OnboardingApiIntegrationTest {

    private static final String URL = "/api/v2/users/me";
    private static final String DEFAULT_USER_TYPE = "여행자";
    private static final String COMPLETE_BODY = """
            {"expectations": ["PHOTO", "LOCAL", "NATURE", "CAFE"], "transportation": "WALK", "travelStyle": "NEAR_DESTINATION"}
            """;
    private static final String OTHER_BODY = """
            {"expectations": ["LOCAL", "CULTURE"], "transportation": "BUS", "travelStyle": "RIGHT_HERE"}
            """;
    private static final String SKIP_BODY = "{}";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserExpectationRepository userExpectationRepository;

    @Autowired
    private UserTransportationRepository userTransportationRepository;

    @Autowired
    private UserTravelStyleRepository userTravelStyleRepository;

    @MockitoSpyBean
    private OnboardingResultRepository onboardingResultRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Test
    void 일반_완료에_성공하면_200과_명세의_응답_필드를_반환한다() throws Exception {
        User user = saveUser("onboarding-it@example.com");

        performPatch(user, COMPLETE_BODY)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.id").value(user.getId()))
                .andExpect(jsonPath("$.user.onboardingCompleted").value(true))
                .andExpect(jsonPath("$.user.onboardingResult.id").isNumber())
                .andExpect(jsonPath("$.user.onboardingResult.userType").value(not(DEFAULT_USER_TYPE)))
                .andExpect(jsonPath("$.user.onboardingResult.typeDescription").isString())
                .andExpect(jsonPath("$.user.onboardingResult.hashtags").isArray())
                .andExpect(jsonPath("$.user.onboardingResult.profileImageUrl").isString());
    }

    @Test
    void 일반_완료하면_선택값과_온보딩_결과가_DB에_저장된다() throws Exception {
        User user = saveUser("onboarding-it@example.com");

        Integer resultId = JsonPath.read(performPatch(user, COMPLETE_BODY)
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(), "$.user.onboardingResult.id");
        flushAndClear();

        assertSelections(user.getId(), List.of(ExpectationType.PHOTO, ExpectationType.LOCAL, ExpectationType.NATURE,
                ExpectationType.CAFE), TransportationType.WALK, TravelStyleType.NEAR_DESTINATION);
        OnboardingResult saved = userRepository.findById(user.getId()).orElseThrow().getOnboardingResult();
        assertThat(saved.getId()).isEqualTo(resultId.longValue());
        assertThat(saved.getUserType()).isNotEqualTo(DEFAULT_USER_TYPE);
    }

    @Test
    void 나중에_할게요에_성공하면_200과_여행자_결과를_반환한다() throws Exception {
        User user = saveUser("onboarding-it@example.com");

        performPatch(user, SKIP_BODY)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.id").value(user.getId()))
                .andExpect(jsonPath("$.user.onboardingCompleted").value(true))
                .andExpect(jsonPath("$.user.onboardingResult.userType").value(DEFAULT_USER_TYPE));
    }

    @Test
    void 나중에_할게요면_기존_선택값을_모두_삭제하고_기본_결과를_저장한다() throws Exception {
        User user = saveUser("onboarding-it@example.com");
        performPatch(user, COMPLETE_BODY).andExpect(status().isOk());
        flushAndClear();

        performPatch(user, SKIP_BODY).andExpect(status().isOk());
        flushAndClear();

        assertNoSelections(user.getId());
        assertThat(userRepository.findById(user.getId()).orElseThrow().getOnboardingResult().getUserType())
                .isEqualTo(DEFAULT_USER_TYPE);
    }

    @Test
    void 요청값_검증에_실패하면_400_INVALID_REQUEST() throws Exception {
        User user = saveUser("onboarding-it@example.com");
        List<String> invalidBodies = List.of(
                "{\"expectations\": [\"PHOTO\"]}",                                        // 일부 필드 누락
                "{\"transportation\": \"WALK\", \"travelStyle\": \"RIGHT_HERE\"}",       // 일부 필드 누락
                "{\"expectations\": [], \"transportation\": \"WALK\", \"travelStyle\": \"RIGHT_HERE\"}",
                "{\"expectations\": [\"PHOTO\", \"PHOTO\"], \"transportation\": \"WALK\", \"travelStyle\": \"RIGHT_HERE\"}",
                "{\"expectations\": [\"BEACH\"], \"transportation\": \"WALK\", \"travelStyle\": \"RIGHT_HERE\"}",
                "{\"expectations\": [\"PHOTO\"], \"transportation\": \"TAXI\", \"travelStyle\": \"RIGHT_HERE\"}",
                "{\"expectations\": [\"PHOTO\"], \"transportation\": \"WALK\", \"travelStyle\": \"FAR_AWAY\"}",
                "{",                                                                    // JSON 파싱 실패
                "{\"expectations\": \"PHOTO\",}"                                         // JSON 파싱 실패
        );

        for (String body : invalidBodies) {
            performPatch(user, body)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                    .andExpect(jsonPath("$.message").value("요청값이 올바르지 않습니다."));
        }
        flushAndClear();
        assertNoSelections(user.getId());
        assertThat(userRepository.findById(user.getId()).orElseThrow().getOnboardingResult()).isNull();
    }

    @Test
    void 다른_선택값으로_재요청하면_기존_선택값과_결과가_교체된다() throws Exception {
        User user = saveUser("onboarding-it@example.com");
        performPatch(user, COMPLETE_BODY).andExpect(status().isOk());
        flushAndClear();

        performPatch(user, OTHER_BODY)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.onboardingResult.userType").value(not(DEFAULT_USER_TYPE)));
        flushAndClear();

        assertSelections(user.getId(), List.of(ExpectationType.LOCAL, ExpectationType.CULTURE),
                TransportationType.BUS, TravelStyleType.RIGHT_HERE);
        assertThat(userRepository.findById(user.getId()).orElseThrow().getOnboardingResult()).isNotNull();
    }

    @Test
    void 동일한_요청을_반복해도_기대_항목이_중복_저장되지_않는다() throws Exception {
        User user = saveUser("onboarding-it@example.com");

        for (int i = 0; i < 3; i++) {
            performPatch(user, COMPLETE_BODY).andExpect(status().isOk());
            flushAndClear();
        }

        assertSelections(user.getId(), List.of(ExpectationType.PHOTO, ExpectationType.LOCAL, ExpectationType.NATURE,
                ExpectationType.CAFE), TransportationType.WALK, TravelStyleType.NEAR_DESTINATION);
    }

    @Test
    void 일반_완료_후_건너뛰면_선택값이_삭제되고_여행자_결과로_바뀐다() throws Exception {
        User user = saveUser("onboarding-it@example.com");
        performPatch(user, COMPLETE_BODY)
                .andExpect(jsonPath("$.user.onboardingResult.userType").value(not(DEFAULT_USER_TYPE)));
        flushAndClear();

        performPatch(user, SKIP_BODY)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.onboardingResult.userType").value(DEFAULT_USER_TYPE));
        flushAndClear();

        assertNoSelections(user.getId());
    }

    @Test
    void 건너뛴_후_일반_완료하면_새_선택값과_일반_결과가_저장된다() throws Exception {
        User user = saveUser("onboarding-it@example.com");
        performPatch(user, SKIP_BODY)
                .andExpect(jsonPath("$.user.onboardingResult.userType").value(DEFAULT_USER_TYPE));
        flushAndClear();

        performPatch(user, OTHER_BODY)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.onboardingResult.userType").value(not(DEFAULT_USER_TYPE)));
        flushAndClear();

        assertSelections(user.getId(), List.of(ExpectationType.LOCAL, ExpectationType.CULTURE),
                TransportationType.BUS, TravelStyleType.RIGHT_HERE);
        assertThat(userRepository.findById(user.getId()).orElseThrow().getOnboardingResult().getUserType())
                .isNotEqualTo(DEFAULT_USER_TYPE);
    }

    /**
     * 테스트 트랜잭션 안에서는 서비스 트랜잭션이 합류해 실제 롤백을 확인할 수 없으므로
     * 이 테스트만 트랜잭션 없이 실행하고, 만든 사용자는 직접 삭제한다. (선택값은 FK CASCADE로 함께 삭제)
     */
    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void 결과_배정에_실패하면_500을_반환하고_기존_선택값과_결과가_유지된다() throws Exception {
        User user = saveUser("onboarding-rollback-it@example.com");
        try {
            performPatch(user, COMPLETE_BODY).andExpect(status().isOk());
            Long resultId = findOnboardingResultId(user.getId());

            doReturn(List.of()).when(onboardingResultRepository).findAllByUserTypeNot(any());
            performPatch(user, OTHER_BODY)
                    .andExpect(status().isInternalServerError())
                    .andExpect(jsonPath("$.code").value("INTERNAL_SERVER_ERROR"))
                    .andExpect(jsonPath("$.message").value("서버 내부 오류가 발생했습니다."));

            transactionTemplate.executeWithoutResult(status -> assertSelections(user.getId(),
                    List.of(ExpectationType.PHOTO, ExpectationType.LOCAL, ExpectationType.NATURE, ExpectationType.CAFE),
                    TransportationType.WALK, TravelStyleType.NEAR_DESTINATION));
            assertThat(findOnboardingResultId(user.getId())).isEqualTo(resultId);
        } finally {
            userRepository.deleteById(user.getId());
        }
    }

    private User saveUser(String email) {
        return userRepository.saveAndFlush(User.builder()
                .email(email)
                .passwordHash("{bcrypt-hash}")
                .nickname("몽글몽글파도")
                .build());
    }

    private ResultActions performPatch(User user, String body) throws Exception {
        return mockMvc.perform(patch(URL)
                .header("Authorization", "Bearer " + jwtTokenProvider.createAccessToken(user).value())
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    /** 영속성 컨텍스트를 비워 이후 조회가 실제 DB 값을 읽도록 한다. */
    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }

    private Long findOnboardingResultId(Long userId) {
        return transactionTemplate.execute(status ->
                userRepository.findById(userId).orElseThrow().getOnboardingResult().getId());
    }

    private void assertSelections(Long userId, List<ExpectationType> expectations,
                                  TransportationType transportation, TravelStyleType travelStyle) {
        assertThat(userExpectationRepository.findAllByUserId(userId))
                .extracting(UserExpectation::getExpectation)
                .extracting(expectation -> expectation.getExpectationType())
                .containsExactlyInAnyOrderElementsOf(expectations);
        assertThat(userTransportationRepository.findById(userId).orElseThrow()
                .getTransportation().getTransportationType()).isEqualTo(transportation);
        assertThat(userTravelStyleRepository.findById(userId).orElseThrow()
                .getTravelStyle().getTravelStyleType()).isEqualTo(travelStyle);
    }

    private void assertNoSelections(Long userId) {
        assertThat(userExpectationRepository.findAllByUserId(userId)).isEmpty();
        assertThat(userTransportationRepository.findById(userId)).isEmpty();
        assertThat(userTravelStyleRepository.findById(userId)).isEmpty();
    }
}
