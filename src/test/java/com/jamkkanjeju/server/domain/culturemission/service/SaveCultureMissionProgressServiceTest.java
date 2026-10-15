package com.jamkkanjeju.server.domain.culturemission.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.culturemission.support.CultureMissionFixtures.*;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.location;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.treasureMission;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.common.exception.*;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.culturemission.dto.*;
import com.jamkkanjeju.server.domain.culturemission.entity.*;
import com.jamkkanjeju.server.domain.culturemission.exception.CultureMissionErrorCode;
import com.jamkkanjeju.server.domain.culturemission.repository.*;
import com.jamkkanjeju.server.domain.map.service.NextLocationRecommender;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionRepository;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

/** 저장 서비스의 검증 순서, 원문 채점, 진행·완료 분기와 협력 객체 연결을 검증한다. */
@ExtendWith(MockitoExtension.class)
class SaveCultureMissionProgressServiceTest {
    @Mock UserRepository users;
    @Mock CultureMissionRepository missions;
    @Mock CultureMissionProgressRepository progresses;
    @Mock CultureMissionQuizRepository quizzes;
    @Mock CooperativeMissionRepository cooperative;
    @Mock TreasureMissionRepository treasure;
    @Mock CultureMissionRewardGranter rewards;
    @Mock NextLocationRecommender recommender;
    @Mock TourApiClient images;
    CultureMissionService service;
    User user;
    CultureMission mission;
    CultureMissionProgress progress;
    static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-15T03:00:00Z"), ZoneId.of("Asia/Seoul"));
    static final SaveCultureMissionProgressLocationRequest LOCATION = new SaveCultureMissionProgressLocationRequest(33.0,126.0);
    @BeforeEach void setup() {
        service = new CultureMissionService(users, missions, progresses, quizzes, cooperative, treasure, rewards, recommender, images, CLOCK);
        user = activeUser(15L);
        mission = cultureMission(31L, MissionActivationStatus.ACTIVE);
        progress = progress(7L,user,mission,MissionProgressStatus.IN_PROGRESS,1,0,LAST_COMPLETED_AT);
    }
    private SaveCultureMissionProgressResponse save(int index, String answer) {
        return service.saveCultureMissionProgress(15L,7L,LOCATION,new SaveCultureMissionProgressRequest(index,answer));
    }
    private void found() {
        when(users.findById(15L)).thenReturn(Optional.of(user));
        when(progresses.findByIdAndUserIdAndMissionStatus(7L,15L,MissionProgressStatus.IN_PROGRESS)).thenReturn(Optional.of(progress));
    }
    private void quiz(CultureMissionQuiz quiz, int count) {
        when(quizzes.findById(new CultureMissionQuizId(31L,1))).thenReturn(Optional.of(quiz));
        when(quizzes.countByIdCultureMissionId(31L)).thenReturn((long)count);
    }
    private void error(Runnable operation, Object code) {
        assertThatThrownBy(operation::run).isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(code);
    }
    @Test void missingUserStopsAllProcessing() {
        error(()->save(1,"많이"),CommonErrorCode.UNAUTHORIZED);
        verifyNoInteractions(progresses,quizzes,rewards,recommender,images);
    }
    @Test void missingOwnedInProgressRecordStopsProcessing() {
        when(users.findById(15L)).thenReturn(Optional.of(user));
        error(()->save(1,"많이"),CultureMissionErrorCode.CULTURE_MISSION_PROGRESS_NOT_FOUND);
        verify(progresses).findByIdAndUserIdAndMissionStatus(7L,15L,MissionProgressStatus.IN_PROGRESS);
        verifyNoInteractions(quizzes,rewards,recommender,images);
    }
    @Test void inactiveMissionDoesNotChangeProgress() {
        mission = cultureMission(31L,MissionActivationStatus.INACTIVE);
        progress = progress(7L,user,mission,MissionProgressStatus.IN_PROGRESS,1,0,LAST_COMPLETED_AT);
        found();
        error(()->save(1,"많이"),CultureMissionErrorCode.CULTURE_MISSION_INACTIVE);
        assertThat(progress.getCurrentQuizIndex()).isEqualTo(1);
        verifyNoInteractions(quizzes,rewards,recommender);
    }
    @Test void wrongQuizIndexDoesNotChangeProgress() {
        found();
        error(()->save(2,"많이"),CultureMissionErrorCode.CULTURE_MISSION_QUIZ_INDEX_MISMATCH);
        assertThat(progress.getCorrectCount()).isZero();
        assertThat(progress.getCurrentQuizIndex()).isEqualTo(1);
        verifyNoInteractions(quizzes,rewards,recommender);
    }
    @ParameterizedTest @ValueSource(strings={"많이","오답"," 많이 ","MANY",""})
    void shortAnswerUsesExactComparisonAndAdvancesWithoutRewards(String answer) {
        found();quiz(shortAnswerQuiz(mission,1),2);
        var response=save(1,answer);
        assertThat(response.isCorrect()).isEqualTo(answer.equals("많이"));
        assertThat(response.answer()).isEqualTo("많이");
        assertThat(response.explanation()).isNull();
        assertThat(response.currentQuizNumber()).isEqualTo(2);
        assertThat(response.correctNumber()).isEqualTo(answer.equals("많이")?1:0);
        assertThat(response.quizCount()).isEqualTo(2);
        assertThat(response.missionProgressStatus()).isEqualTo("IN_PROGRESS");
        assertThat(response.nextLocation()).isNull();assertThat(response.reward()).isNull();
        assertThat(progress.getLastCompletedAt()).isEqualTo(LAST_COMPLETED_AT);
        verifyNoInteractions(rewards,recommender,images);
    }
    @Test void multipleChoiceUsesSubmittedStringAndSubmittedQuizExplanation() {
        found();quiz(multipleChoiceQuiz(mission,1),3);
        var response=save(1,"하르방");
        assertThat(response.isCorrect()).isTrue();
        assertThat(response.explanation()).isEqualTo("해설 1");
        verify(quizzes).findById(new CultureMissionQuizId(31L,1));
    }
    private void completedDependencies() {
        when(rewards.grant(user,mission,1)).thenReturn(CultureMissionRewardGranter.GrantedReward.NONE);
        when(recommender.recommend(33.0,126.0)).thenReturn(Optional.of(new NextLocationRecommender.RecommendedLocation(location(8L,"다음 장소",33,126),42)));
    }
    @Test void completionKeepsLastIndexAndUsesClockAndReturnsEmptyRewardObject() {
        found();quiz(shortAnswerQuiz(mission,1),1);completedDependencies();
        var response=save(1,"많이");
        assertThat(progress.getLastCompletedAt()).isEqualTo(LocalDateTime.now(CLOCK));
        assertThat(response.currentQuizNumber()).isEqualTo(1);
        assertThat(response.correctNumber()).isEqualTo(1);
        assertThat(response.missionProgressStatus()).isEqualTo("COMPLETED");
        assertThat(response.reward()).isEqualTo(new SaveCultureMissionProgressResponse.Reward(null,null,null));
        assertThat(response.nextLocation().id()).isEqualTo(8L);
        assertThat(response.nextLocation().distanceMeter()).isEqualTo(42);
        assertThat(response.nextLocation().mission()).isNull();
        assertThat(response.nextLocation().locationImageUrl()).isNull();
        verify(rewards).grant(user,mission,1);verify(images).getLocationImageUrl(8L);
    }
    @Test void wrongFinalAnswerKeepsExistingCorrectCountAndPicksOnlyActiveMission() {
        progress = progress(7L,user,mission,MissionProgressStatus.IN_PROGRESS,1,1,LAST_COMPLETED_AT);
        found();quiz(shortAnswerQuiz(mission,1),1);completedDependencies();
        when(treasure.findAllByLocationIdAndStatus(8L,MissionActivationStatus.ACTIVE))
            .thenReturn(List.of(treasureMission(45L,location(8L,"다음 장소",33,126),3)));
        var response=save(1,"오답");
        assertThat(response.isCorrect()).isFalse();assertThat(response.correctNumber()).isEqualTo(1);
        assertThat(response.nextLocation().mission()).isEqualTo(new SaveCultureMissionProgressResponse.NextMission(45L,"TREASURE"));
        verify(cooperative).findAllByLocationIdAndStatus(8L,MissionActivationStatus.ACTIVE);
    }
    @Test void missingQuizFailsBeforeMutation() {
        found();
        assertThatThrownBy(()->save(1,"많이")).isInstanceOf(IllegalStateException.class);
        assertThat(progress.getCurrentQuizIndex()).isEqualTo(1);verifyNoInteractions(rewards,recommender);
    }
    @Test void missingRequiredRecommendationPropagatesFailure() {
        found();quiz(shortAnswerQuiz(mission,1),1);
        when(rewards.grant(user,mission,1)).thenReturn(CultureMissionRewardGranter.GrantedReward.NONE);
        assertThatThrownBy(()->save(1,"많이")).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(images);
    }
    @Test void rewardFailurePropagatesAndStopsRecommendation() {
        found();quiz(shortAnswerQuiz(mission,1),1);
        var failure=new IllegalStateException("보상 실패");when(rewards.grant(user,mission,1)).thenThrow(failure);
        assertThatThrownBy(()->save(1,"많이")).isSameAs(failure);verifyNoInteractions(recommender,images);
    }
}
