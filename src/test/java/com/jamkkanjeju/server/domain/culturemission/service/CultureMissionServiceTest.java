package com.jamkkanjeju.server.domain.culturemission.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.culturemission.support.CultureMissionFixtures.LAST_COMPLETED_AT;
import static com.jamkkanjeju.server.domain.culturemission.support.CultureMissionFixtures.cultureMission;
import static com.jamkkanjeju.server.domain.culturemission.support.CultureMissionFixtures.multipleChoiceQuiz;
import static com.jamkkanjeju.server.domain.culturemission.support.CultureMissionFixtures.progress;
import static com.jamkkanjeju.server.domain.culturemission.support.CultureMissionFixtures.shortAnswerQuiz;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.culturemission.dto.StartCultureMissionResponse;
import com.jamkkanjeju.server.domain.culturemission.dto.StartCultureMissionResponse.QuizDetail;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionQuiz;
import com.jamkkanjeju.server.domain.culturemission.exception.CultureMissionErrorCode;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionProgressRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionQuizRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionRepository;
import com.jamkkanjeju.server.domain.map.service.NextLocationRecommender;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionRepository;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class CultureMissionServiceTest {

    private static final Long USER_ID = 15L;
    private static final Long MISSION_ID = 31L;

    @Mock
    private UserRepository userRepository;
    @Mock
    private CultureMissionRepository cultureMissionRepository;
    @Mock
    private CultureMissionProgressRepository cultureMissionProgressRepository;
    @Mock
    private CultureMissionQuizRepository cultureMissionQuizRepository;
    @Mock
    private CooperativeMissionRepository cooperativeMissionRepository;
    @Mock
    private TreasureMissionRepository treasureMissionRepository;
    @Mock
    private CultureMissionRewardGranter cultureMissionRewardGranter;
    @Mock
    private NextLocationRecommender nextLocationRecommender;
    @Mock
    private TourApiClient tourApiClient;

    private CultureMissionService cultureMissionService;
    private User user;
    private CultureMission activeMission;
    private List<CultureMissionQuiz> quizzes;

    @BeforeEach
    void setUp() {
        cultureMissionService = new CultureMissionService(userRepository, cultureMissionRepository,
                cultureMissionProgressRepository, cultureMissionQuizRepository,
                cooperativeMissionRepository, treasureMissionRepository, cultureMissionRewardGranter,
                nextLocationRecommender, tourApiClient, Clock.systemDefaultZone());
        user = activeUser(USER_ID);
        activeMission = cultureMission(MISSION_ID, MissionActivationStatus.ACTIVE);
        quizzes = List.of(multipleChoiceQuiz(activeMission, 1), shortAnswerQuiz(activeMission, 2));
    }

    @Test
    void 사용자가_없으면_UNAUTHORIZED이고_미션_조회와_진행도_변경을_하지_않는다() {
        given(userRepository.findById(USER_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> cultureMissionService.startCultureMission(USER_ID, MISSION_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(CommonErrorCode.UNAUTHORIZED);

        verifyNoInteractions(cultureMissionRepository, cultureMissionProgressRepository, cultureMissionQuizRepository);
    }

    @Test
    void 문화_미션이_없으면_CULTURE_MISSION_NOT_FOUND이고_진행도를_조회하거나_만들지_않는다() {
        given(userRepository.findById(USER_ID)).willReturn(Optional.of(user));
        given(cultureMissionRepository.findById(MISSION_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> cultureMissionService.startCultureMission(USER_ID, MISSION_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(CultureMissionErrorCode.CULTURE_MISSION_NOT_FOUND);

        verifyNoInteractions(cultureMissionProgressRepository, cultureMissionQuizRepository);
    }

    @Test
    void 비활성_미션이면_CULTURE_MISSION_INACTIVE이고_진행도를_조회_초기화_생성하지_않는다() {
        given(userRepository.findById(USER_ID)).willReturn(Optional.of(user));
        given(cultureMissionRepository.findById(MISSION_ID))
                .willReturn(Optional.of(cultureMission(MISSION_ID, MissionActivationStatus.INACTIVE)));

        assertThatThrownBy(() -> cultureMissionService.startCultureMission(USER_ID, MISSION_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(CultureMissionErrorCode.CULTURE_MISSION_INACTIVE);

        verifyNoInteractions(cultureMissionProgressRepository, cultureMissionQuizRepository);
    }

    @Test
    void 현재_사용자_ID와_요청한_미션_ID로_진행도를_조회한다() {
        givenProgress(Optional.empty());
        givenSaveAssignsId(100L);
        givenQuizzes();

        cultureMissionService.startCultureMission(USER_ID, MISSION_ID);

        verify(cultureMissionProgressRepository).findByUserIdAndCultureMissionMissionId(USER_ID, MISSION_ID);
    }

    @Test
    void 진행도가_없으면_사용자와_미션에_연결된_진행도를_첫_퀴즈부터_새로_저장한다() {
        givenProgress(Optional.empty());
        givenSaveAssignsId(100L);
        givenQuizzes();

        cultureMissionService.startCultureMission(USER_ID, MISSION_ID);

        ArgumentCaptor<CultureMissionProgress> captor = ArgumentCaptor.forClass(CultureMissionProgress.class);
        verify(cultureMissionProgressRepository).save(captor.capture());
        CultureMissionProgress saved = captor.getValue();
        assertThat(saved.getUser()).isSameAs(user);
        assertThat(saved.getCultureMission()).isSameAs(activeMission);
        assertThat(saved.getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        assertThat(saved.getCurrentQuizIndex()).isEqualTo(1);
        assertThat(saved.getCorrectCount()).isZero();
        assertThat(saved.getLastCompletedAt()).isNull();
    }

    @Test
    void 최초_시작_응답은_저장으로_생긴_진행도_ID를_쓰고_생성_여부가_true다() {
        givenProgress(Optional.empty());
        givenSaveAssignsId(100L);
        givenQuizzes();

        StartCultureMissionResponse response = cultureMissionService.startCultureMission(USER_ID, MISSION_ID);

        assertThat(response.cultureMissionProgressId()).isEqualTo(100L);
        assertThat(response.currentQuizNumber()).isEqualTo(1);
        assertThat(response.created()).isTrue();
    }

    @Test
    void 진행_중이면_ID_퀴즈_번호_정답_수_마지막_완료_시각을_유지하고_새로_저장하지_않는다() {
        CultureMissionProgress inProgress = progress(7L, user, activeMission,
                MissionProgressStatus.IN_PROGRESS, 3, 2, LAST_COMPLETED_AT);
        givenProgress(Optional.of(inProgress));
        givenQuizzes();

        StartCultureMissionResponse response = cultureMissionService.startCultureMission(USER_ID, MISSION_ID);

        assertThat(response.cultureMissionProgressId()).isEqualTo(7L);
        assertThat(response.currentQuizNumber()).isEqualTo(3);
        assertThat(inProgress.getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        assertThat(inProgress.getCurrentQuizIndex()).isEqualTo(3);
        assertThat(inProgress.getCorrectCount()).isEqualTo(2);
        assertThat(inProgress.getLastCompletedAt()).isEqualTo(LAST_COMPLETED_AT);
        verify(cultureMissionProgressRepository, never()).save(any());
    }

    @Test
    void 완료했으면_같은_진행도를_초기화하고_마지막_완료_시각은_유지하며_새로_저장하지_않는다() {
        CultureMissionProgress completed = progress(7L, user, activeMission,
                MissionProgressStatus.COMPLETED, 3, 3, LAST_COMPLETED_AT);
        givenProgress(Optional.of(completed));
        givenQuizzes();

        StartCultureMissionResponse response = cultureMissionService.startCultureMission(USER_ID, MISSION_ID);

        assertThat(response.cultureMissionProgressId()).isEqualTo(7L);
        assertThat(response.currentQuizNumber()).isEqualTo(1);
        assertThat(completed.getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        assertThat(completed.getCurrentQuizIndex()).isEqualTo(1);
        assertThat(completed.getCorrectCount()).isZero();
        assertThat(completed.getLastCompletedAt()).isEqualTo(LAST_COMPLETED_AT);
        verify(cultureMissionProgressRepository, never()).save(any());
    }

    @Test
    void 이어하기와_재시작의_생성_여부는_false다() {
        givenProgress(Optional.of(progress(7L, user, activeMission,
                MissionProgressStatus.IN_PROGRESS, 2, 1, null)));
        givenQuizzes();
        assertThat(cultureMissionService.startCultureMission(USER_ID, MISSION_ID).created()).isFalse();

        givenProgress(Optional.of(progress(8L, user, activeMission,
                MissionProgressStatus.COMPLETED, 3, 3, LAST_COMPLETED_AT)));
        assertThat(cultureMissionService.startCultureMission(USER_ID, MISSION_ID).created()).isFalse();
    }

    @Test
    void 요청한_미션_ID로_퀴즈를_번호순_조회하고_그_목록으로_응답을_만든다() {
        givenProgress(Optional.of(progress(7L, user, activeMission,
                MissionProgressStatus.IN_PROGRESS, 1, 0, null)));
        givenQuizzes();

        StartCultureMissionResponse response = cultureMissionService.startCultureMission(USER_ID, MISSION_ID);

        verify(cultureMissionQuizRepository).findAllByIdCultureMissionIdOrderByIdQuizIndexAsc(MISSION_ID);
        assertThat(response.quizCount()).isEqualTo(2);
        assertThat(response.quizDetails()).extracting(QuizDetail::quizIndex).containsExactly(1, 2);
    }

    @Test
    void 진행도_저장이나_퀴즈_조회_실패를_숨기지_않고_그대로_전달한다() {
        IllegalStateException saveFailure = new IllegalStateException("저장 실패");
        givenProgress(Optional.empty());
        given(cultureMissionProgressRepository.save(any())).willThrow(saveFailure);
        assertThatThrownBy(() -> cultureMissionService.startCultureMission(USER_ID, MISSION_ID)).isSameAs(saveFailure);

        IllegalStateException quizFailure = new IllegalStateException("퀴즈 조회 실패");
        givenProgress(Optional.of(progress(7L, user, activeMission,
                MissionProgressStatus.IN_PROGRESS, 1, 0, null)));
        given(cultureMissionQuizRepository.findAllByIdCultureMissionIdOrderByIdQuizIndexAsc(MISSION_ID))
                .willThrow(quizFailure);
        assertThatThrownBy(() -> cultureMissionService.startCultureMission(USER_ID, MISSION_ID)).isSameAs(quizFailure);
    }

    /** 활성 사용자·미션과 사용자의 기존 진행도를 준비한다. */
    private void givenProgress(Optional<CultureMissionProgress> progress) {
        given(userRepository.findById(USER_ID)).willReturn(Optional.of(user));
        given(cultureMissionRepository.findById(MISSION_ID)).willReturn(Optional.of(activeMission));
        given(cultureMissionProgressRepository.findByUserIdAndCultureMissionMissionId(USER_ID, MISSION_ID))
                .willReturn(progress);
    }

    /** 저장 시 DB가 ID를 채워 주는 것처럼 진행도에 ID를 넣어 돌려준다. */
    private void givenSaveAssignsId(Long id) {
        given(cultureMissionProgressRepository.save(any())).willAnswer(invocation -> {
            CultureMissionProgress saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", id);
            return saved;
        });
    }

    private void givenQuizzes() {
        given(cultureMissionQuizRepository.findAllByIdCultureMissionIdOrderByIdQuizIndexAsc(MISSION_ID))
                .willReturn(quizzes);
    }
}
