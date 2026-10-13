package com.jamkkanjeju.server.domain.home.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.cooperativeMission;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.cooperativeProgress;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.cultureMission;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.cultureProgress;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.location;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.participant;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.treasureMission;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.treasureProgress;
import static com.jamkkanjeju.server.domain.onboarding.support.OnboardingFixtures.defaultResult;
import static com.jamkkanjeju.server.domain.onboarding.support.OnboardingFixtures.onboardingResult;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantStatus;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionProgressRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionQuizRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionQuizRepository.QuizCount;
import com.jamkkanjeju.server.domain.guestbook.service.GuestbookCounter;
import com.jamkkanjeju.server.domain.home.dto.GetHomeRequest;
import com.jamkkanjeju.server.domain.home.dto.GetHomeResponse;
import com.jamkkanjeju.server.domain.home.dto.GetHomeResponse.MissionRecommendInfo;
import com.jamkkanjeju.server.domain.home.dto.GetHomeResponse.ProgressMissionInfo;
import com.jamkkanjeju.server.domain.home.support.HomeFixtures;
import com.jamkkanjeju.server.domain.map.service.TravelEstimator;
import com.jamkkanjeju.server.domain.map.service.TravelEstimator.TravelEstimate;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;
import com.jamkkanjeju.server.domain.mission.service.MissionCompletionChecker;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionProgressRepository;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class HomeServiceTest {

    private static final double LAT = 33.5572;
    private static final double LNG = 126.7591;
    private static final GetHomeRequest REQUEST = new GetHomeRequest(LAT, LNG);
    /** 장소가 있는 미션에 대해 Mock TravelEstimator가 돌려주는 거리·시간 */
    private static final TravelEstimate LOCATED_ESTIMATE = new TravelEstimate(250, 3);

    @Mock
    private UserRepository userRepository;
    @Mock
    private CultureMissionProgressRepository cultureMissionProgressRepository;
    @Mock
    private CultureMissionQuizRepository cultureMissionQuizRepository;
    @Mock
    private TreasureMissionProgressRepository treasureMissionProgressRepository;
    @Mock
    private CooperativeMissionParticipantRepository cooperativeMissionParticipantRepository;
    @Mock
    private MissionRecommender missionRecommender;
    @Mock
    private GuestbookCounter guestbookCounter;
    @Mock
    private TravelEstimator travelEstimator;

    private HomeService homeService;
    private User user;

    @BeforeEach
    void setUp() {
        homeService = new HomeService(userRepository, cultureMissionProgressRepository, cultureMissionQuizRepository,
                treasureMissionProgressRepository, cooperativeMissionParticipantRepository,
                new MissionCompletionChecker(), missionRecommender, guestbookCounter, travelEstimator);
        user = activeUser(15L);
        lenient().when(travelEstimator.estimate(anyDouble(), anyDouble(), any())).thenAnswer(invocation ->
                invocation.getArgument(2) == null ? TravelEstimate.UNKNOWN : LOCATED_ESTIMATE);
    }

    @Test
    void 사용자가_없으면_UNAUTHORIZED이고_홈_정보를_조회하지_않는다() {
        given(userRepository.findById(15L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> homeService.getHome(15L, REQUEST))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(CommonErrorCode.UNAUTHORIZED);

        verifyNoInteractions(cultureMissionProgressRepository, cultureMissionQuizRepository,
                treasureMissionProgressRepository, cooperativeMissionParticipantRepository,
                missionRecommender, guestbookCounter);
    }

    @Test
    void 완료한_미션_ID와_요청_위치를_추천기에_전달하고_추천_결과를_응답에_담는다() {
        CooperativeMission completedCooperative = cooperativeMission(31L, null);
        List<MissionRecommendInfo> recommends = List.of(
                MissionRecommendInfo.of(HomeFixtures.mission(41L, MissionTypeCode.CULTURE), null, null, null));
        givenHomeData(user, List.of(), Map.of(),
                List.of(treasureProgress(user, treasureMission(21L, null, 3), 3, MissionProgressStatus.COMPLETED)),
                List.of(participant(user, cooperativeProgress(1L, completedCooperative, 3,
                        MissionProgressStatus.COMPLETED), ParticipantStatus.ACCEPTED)));
        given(missionRecommender.recommend(LAT, LNG, Set.of(21L), Set.of(31L))).willReturn(recommends);

        GetHomeResponse response = homeService.getHome(15L, REQUEST);

        verify(missionRecommender).recommend(LAT, LNG, Set.of(21L), Set.of(31L));
        assertThat(response.missionRecommend()).isEqualTo(recommends);
    }

    @Test
    void 문화_진행은_퀴즈_개수와_현재_퀴즈_인덱스로_단계를_구성한다() {
        givenHomeData(user, List.of(cultureProgress(user, cultureMission(51L), 2)), Map.of(51L, 5L),
                List.of(), List.of());

        ProgressMissionInfo culture = homeService.getHome(15L, REQUEST).progressMission().getFirst();

        assertThat(culture.missionId()).isEqualTo(51L);
        assertThat(culture.missionType()).isEqualTo("CULTURE");
        assertThat(culture.totalStep()).isEqualTo(5);
        assertThat(culture.currentStep()).isEqualTo(2);
    }

    @Test
    void 서로_다른_문화_미션의_퀴즈_개수를_각_미션에_연결한다() {
        givenHomeData(user, List.of(cultureProgress(user, cultureMission(51L), 1),
                        cultureProgress(user, cultureMission(52L), 4)),
                Map.of(51L, 3L, 52L, 7L), List.of(), List.of());

        List<ProgressMissionInfo> progress = homeService.getHome(15L, REQUEST).progressMission();

        assertThat(progress).extracting(ProgressMissionInfo::missionId, ProgressMissionInfo::totalStep,
                        ProgressMissionInfo::currentStep)
                .containsExactlyInAnyOrder(
                        tuple(51L, 3, 1),
                        tuple(52L, 7, 4));
    }

    @Test
    void 보물찾기_진행은_전체_보물_수와_찾은_보물_수로_단계를_구성하고_0개도_그대로_반환한다() {
        givenHomeData(user, List.of(), Map.of(), List.of(treasureProgress(user,
                treasureMission(61L, location(1L, "보물 장소", 33.5, 126.5), 5), 0,
                MissionProgressStatus.IN_PROGRESS)), List.of());

        ProgressMissionInfo treasure = homeService.getHome(15L, REQUEST).progressMission().getFirst();

        assertThat(treasure.missionId()).isEqualTo(61L);
        assertThat(treasure.missionType()).isEqualTo("TREASURE");
        assertThat(treasure.totalStep()).isEqualTo(5);
        assertThat(treasure.currentStep()).isZero();
    }

    @Test
    void 협동_진행은_참가_상태와_무관하게_현재_사용자의_IN_PROGRESS_팀을_포함한다() {
        CooperativeMission cooperative = cooperativeMission(71L, location(1L, "협동 장소", 33.5, 126.5));
        givenHomeData(user, List.of(), Map.of(), List.of(), List.of(participant(user,
                cooperativeProgress(1L, cooperative, 1, MissionProgressStatus.IN_PROGRESS),
                ParticipantStatus.PENDING)));

        assertThat(homeService.getHome(15L, REQUEST).progressMission())
                .extracting(ProgressMissionInfo::missionId, ProgressMissionInfo::missionType)
                .containsExactly(tuple(71L, "COOPERATIVE"));
    }

    @Test
    void 협동_단계는_팀의_현재_단계와_미션_유형의_단계_개수를_사용한다() {
        CooperativeMission cooperative = cooperativeMission(71L, location(1L, "협동 장소", 33.5, 126.5));
        givenHomeData(user, List.of(), Map.of(), List.of(), List.of(participant(user,
                cooperativeProgress(1L, cooperative, 2, MissionProgressStatus.IN_PROGRESS),
                ParticipantStatus.ACCEPTED)));

        ProgressMissionInfo progress = homeService.getHome(15L, REQUEST).progressMission().getFirst();

        assertThat(progress.totalStep()).isEqualTo(HomeFixtures.DEFAULT_STEP_COUNT);
        assertThat(progress.currentStep()).isEqualTo(2);
    }

    @Test
    void 완료된_보물찾기와_협동_진행_기록은_진행_중_목록에서_제외한다() {
        givenHomeData(user, List.of(), Map.of(),
                List.of(treasureProgress(user, treasureMission(61L, null, 3), 3, MissionProgressStatus.COMPLETED)),
                List.of(participant(user, cooperativeProgress(1L, cooperativeMission(71L, null), 3,
                        MissionProgressStatus.COMPLETED), ParticipantStatus.ACCEPTED)));

        assertThat(homeService.getHome(15L, REQUEST).progressMission()).isEmpty();
    }

    @Test
    void 장소가_없는_진행_미션은_장소명과_거리와_시간이_null이다() {
        givenHomeData(user, List.of(cultureProgress(user, cultureMission(51L), 1)), Map.of(51L, 3L),
                List.of(treasureProgress(user, treasureMission(61L, null, 3), 1, MissionProgressStatus.IN_PROGRESS)),
                List.of());

        assertThat(homeService.getHome(15L, REQUEST).progressMission()).hasSize(2).allSatisfy(progress -> {
            assertThat(progress.locationTitle()).isNull();
            assertThat(progress.distanceMeter()).isNull();
            assertThat(progress.durationMinutes()).isNull();
        });
    }

    @Test
    void 세_유형_모두_진행_중_기록이_없으면_빈_목록이다() {
        givenHomeData(user, List.of(), Map.of(), List.of(), List.of());

        assertThat(homeService.getHome(15L, REQUEST).progressMission()).isEmpty();
        verify(cultureMissionQuizRepository, never()).countByCultureMissionIds(any());
    }

    @Test
    void 방명록_집계_컴포넌트의_전체_개수를_응답에_담는다() {
        givenHomeData(user, List.of(), Map.of(), List.of(), List.of());
        given(guestbookCounter.countAll()).willReturn(42L);

        assertThat(homeService.getHome(15L, REQUEST).guestbookCount()).isEqualTo(42L);
    }

    @Test
    void 온보딩_결과의_프로필_이미지를_쓰고_결과가_없으면_null이다() {
        User normal = activeUser(16L);
        normal.assignOnboardingResult(onboardingResult(1L, "제주 사진작가"));
        User skipped = activeUser(17L);
        skipped.assignOnboardingResult(defaultResult());
        User none = activeUser(18L);
        givenHomeData(normal, List.of(), Map.of(), List.of(), List.of());
        givenHomeData(skipped, List.of(), Map.of(), List.of(), List.of());
        givenHomeData(none, List.of(), Map.of(), List.of(), List.of());

        assertThat(homeService.getHome(16L, REQUEST).characterImgUrl()).isEqualTo("https://example.com/1.png");
        assertThat(homeService.getHome(17L, REQUEST).characterImgUrl()).isEqualTo("https://example.com/7.png");
        assertThat(homeService.getHome(18L, REQUEST).characterImgUrl()).isNull();
    }

    @Test
    void 조회_중_예기치_않은_오류는_숨기지_않고_그대로_전달한다() {
        IllegalStateException failure = new IllegalStateException("집계 실패");
        givenHomeData(user, List.of(), Map.of(), List.of(), List.of());
        given(guestbookCounter.countAll()).willThrow(failure);

        assertThatThrownBy(() -> homeService.getHome(15L, REQUEST)).isSameAs(failure);
    }

    /** 사용자와 사용자별 진행 기록, 문화 미션별 퀴즈 개수를 준비한다. 추천 결과는 빈 목록이다. */
    private void givenHomeData(User target, List<CultureMissionProgress> cultureProgresses,
                               Map<Long, Long> quizCounts, List<TreasureMissionProgress> treasureProgresses,
                               List<CooperativeMissionParticipant> participants) {
        given(userRepository.findById(target.getId())).willReturn(Optional.of(target));
        given(cultureMissionProgressRepository.findAllByUserIdAndMissionStatus(target.getId(),
                MissionProgressStatus.IN_PROGRESS)).willReturn(cultureProgresses);
        if (!cultureProgresses.isEmpty()) {
            given(cultureMissionQuizRepository.countByCultureMissionIds(any())).willAnswer(invocation -> {
                Collection<Long> ids = invocation.getArgument(0);
                return ids.stream().filter(quizCounts::containsKey)
                        .map(id -> quizCount(id, quizCounts.get(id))).toList();
            });
        }
        given(treasureMissionProgressRepository.findAllByUserId(target.getId())).willReturn(treasureProgresses);
        given(cooperativeMissionParticipantRepository.findAllByUserId(target.getId())).willReturn(participants);
        lenient().when(missionRecommender.recommend(anyDouble(), anyDouble(), any(), any())).thenReturn(List.of());
    }

    private static QuizCount quizCount(Long cultureMissionId, long count) {
        return new QuizCount() {
            @Override
            public Long getCultureMissionId() {
                return cultureMissionId;
            }

            @Override
            public long getQuizCount() {
                return count;
            }
        };
    }
}
