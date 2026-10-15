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
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** 중단 검증과 즉시 완료, 기존 보상·추천 컴포넌트 연결을 검증한다. */
@ExtendWith(MockitoExtension.class)
class StopCultureMissionServiceTest {
    @Mock UserRepository users;
    @Mock CultureMissionRepository missions;
    @Mock CultureMissionProgressRepository progresses;
    @Mock CultureMissionQuizRepository quizzes;
    @Mock CooperativeMissionRepository cooperative;
    @Mock TreasureMissionRepository treasure;
    @Mock CultureMissionRewardGranter rewards;
    @Mock NextLocationRecommender recommender;
    @Mock TourApiClient images;
    static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-15T03:00:00Z"), ZoneId.of("Asia/Seoul"));
    CultureMissionService service;
    User user;
    CultureMission mission;
    CultureMissionProgress progress;

    @BeforeEach void setup() {
        service = new CultureMissionService(users, missions, progresses, quizzes, cooperative, treasure,
                rewards, recommender, images, CLOCK);
        user = activeUser(15L);
        mission = cultureMission(31L, MissionActivationStatus.ACTIVE);
        progress = progress(7L, user, mission, MissionProgressStatus.IN_PROGRESS, 2, 1, LAST_COMPLETED_AT);
    }
    private StopCultureMissionResponse stop() {
        return service.stopCultureMission(15L, 7L, new StopCultureMissionLocationRequest(33.0, 126.0));
    }
    private void found() {
        when(users.findById(15L)).thenReturn(Optional.of(user));
        when(progresses.findByIdAndUserIdAndMissionStatus(7L, 15L, MissionProgressStatus.IN_PROGRESS))
                .thenReturn(Optional.of(progress));
    }
    private void error(Object code) {
        assertThatThrownBy(this::stop).isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(code);
    }
    @Test void missingUserStopsProcessing() {
        error(CommonErrorCode.UNAUTHORIZED);
        verifyNoInteractions(progresses, quizzes, rewards, recommender, images);
    }
    @Test void missingOwnedInProgressRecordStopsProcessing() {
        when(users.findById(15L)).thenReturn(Optional.of(user));
        error(CultureMissionErrorCode.CULTURE_MISSION_PROGRESS_NOT_FOUND);
        verifyNoInteractions(quizzes, rewards, recommender, images);
    }
    @Test void inactiveMissionPreservesExistingState() {
        mission = cultureMission(31L, MissionActivationStatus.INACTIVE);
        progress = progress(7L, user, mission, MissionProgressStatus.IN_PROGRESS, 2, 1, LAST_COMPLETED_AT);
        found();
        error(CultureMissionErrorCode.CULTURE_MISSION_INACTIVE);
        assertThat(progress.getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        assertThat(progress.getLastCompletedAt()).isEqualTo(LAST_COMPLETED_AT);
        verifyNoInteractions(quizzes, rewards, recommender, images);
    }
    @Test void completesBeforeRewardWithoutChangingIndexOrCountAndReturnsRecommendation() {
        found();
        when(rewards.grant(user, mission, 1)).thenAnswer(invocation -> {
            assertThat(progress.getMissionStatus()).isEqualTo(MissionProgressStatus.COMPLETED);
            assertThat(progress.getLastCompletedAt()).isEqualTo(LocalDateTime.now(CLOCK));
            return CultureMissionRewardGranter.GrantedReward.NONE;
        });
        when(recommender.recommend(33, 126)).thenReturn(Optional.of(
                new NextLocationRecommender.RecommendedLocation(location(8L, "추천 장소", 33, 126), 42)));
        when(quizzes.countByIdCultureMissionId(31L)).thenReturn(3L);
        var response = stop();
        assertThat(progress.getCurrentQuizIndex()).isEqualTo(2);
        assertThat(progress.getCorrectCount()).isEqualTo(1);
        assertThat(response.missionProgressStatus()).isEqualTo("COMPLETED");
        assertThat(response.quizCount()).isEqualTo(3);
        assertThat(response.correctNumber()).isEqualTo(1);
        assertThat(response.reward()).isEqualTo(new StopCultureMissionResponse.Reward(null, null, null));
        assertThat(response.nextLocation().id()).isEqualTo(8L);
        assertThat(response.nextLocation().distanceMeter()).isEqualTo(42);
        assertThat(response.nextLocation().mission()).isNull();
        assertThat(response.nextLocation().locationImageUrl()).isNull();
        verify(images).getLocationImageUrl(8L);
        verify(quizzes, never()).findById(any());
        verify(progresses, never()).save(any());
    }
    @Test void selectsActiveNextMissionAndPassesImageUrl() {
        found();
        when(rewards.grant(user, mission, 1)).thenReturn(CultureMissionRewardGranter.GrantedReward.NONE);
        var next = location(8L, "추천 장소", 33, 126);
        when(recommender.recommend(33, 126)).thenReturn(Optional.of(new NextLocationRecommender.RecommendedLocation(next, 0)));
        when(treasure.findAllByLocationIdAndStatus(8L, MissionActivationStatus.ACTIVE))
                .thenReturn(List.of(treasureMission(45L, next, 3)));
        when(images.getLocationImageUrl(8L)).thenReturn("https://example.com/image.jpg");
        var response = stop();
        assertThat(response.nextLocation().mission()).isEqualTo(new StopCultureMissionResponse.NextMission(45L, "TREASURE"));
        assertThat(response.nextLocation().locationImageUrl()).isEqualTo("https://example.com/image.jpg");
        verify(cooperative).findAllByLocationIdAndStatus(8L, MissionActivationStatus.ACTIVE);
    }
    @Test void rewardFailurePropagatesBeforeRecommendation() {
        found();
        var failure = new IllegalStateException("보상 실패");
        when(rewards.grant(user, mission, 1)).thenThrow(failure);
        assertThatThrownBy(this::stop).isSameAs(failure);
        verifyNoInteractions(recommender, images);
    }
    @Test void missingRecommendationPropagatesTraceableFailure() {
        found();
        when(rewards.grant(user, mission, 1)).thenReturn(CultureMissionRewardGranter.GrantedReward.NONE);
        assertThatThrownBy(this::stop).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("userId=15", "progressId=7");
        verifyNoInteractions(images);
    }
}
