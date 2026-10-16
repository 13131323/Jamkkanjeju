package com.jamkkanjeju.server.domain.treasurehunt.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.*;
import static com.jamkkanjeju.server.domain.treasurehunt.support.TreasureMissionFixtures.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.map.service.NextLocationRecommender;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.mission.service.MissionRewardGranter;
import com.jamkkanjeju.server.domain.mission.service.NextMissionSelector;
import com.jamkkanjeju.server.domain.treasurehunt.dto.*;
import com.jamkkanjeju.server.domain.treasurehunt.entity.*;
import com.jamkkanjeju.server.domain.treasurehunt.repository.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** 중단의 사전 검증·즉시 완료·기록 유지·보상 미호출과 추천 실패를 검증한다. */
@ExtendWith(MockitoExtension.class)
class StopTreasureMissionServiceTest {
    static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-16T03:00:00Z"), ZoneId.of("Asia/Seoul"));
    @Mock UserRepository users;
    @Mock TreasureMissionRepository missions;
    @Mock TreasureMissionProgressRepository progresses;
    @Mock TreasureMissionProgressItemRepository items;
    @Mock TreasureItemCoordinateGenerator coordinates;
    @Mock TourApiClient images;
    @Mock MissionRewardGranter rewards;
    @Mock NextLocationRecommender recommender;
    @Mock NextMissionSelector nextMissions;
    TreasureMissionService service;
    User user;
    TreasureMission mission;
    TreasureMissionProgress progress;

    @BeforeEach
    void setUp() {
        service = new TreasureMissionService(users, missions, progresses, items, coordinates, images,
                rewards, recommender, nextMissions, CLOCK);
        user = activeUser(15L);
        mission = treasureMission(31L, null, 8);
        progress = progress(user, mission);
    }

    @Test
    void 사용자없음은_모든후속처리를_중단한다() {
        error("UNAUTHORIZED");
        verifyNoInteractions(progresses, items, rewards, recommender, nextMissions, images, coordinates);
    }

    @Test
    void 진행도없음은_변경없이_거절한다() {
        when(users.findById(15L)).thenReturn(Optional.of(user));
        error("TREASURE_MISSION_PROGRESS_NOT_FOUND");
        verifyNoInteractions(items, rewards, recommender, images, coordinates);
    }

    @Test
    void 비활성은_진행상태와_완료시각을_유지한다() {
        found();
        mission.changeStatus(MissionActivationStatus.INACTIVE);
        error("TREASURE_MISSION_INACTIVE");
        assertThat(progress.getMissionStatus()).isEqualTo(MissionProgressStatus.IN_PROGRESS);
        assertThat(progress.getCompletedAt()).isNull();
        verifyNoInteractions(items, rewards, recommender, images, coordinates);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void 발견여부와_관계없이_완료하고_실제개수와_기존기록을_유지한다(boolean hasFound) {
        found();
        var first = item(progress, 1, hasFound);
        var second = item(progress, 4, false);
        if (hasFound) progress.increaseFoundItemCount();
        when(items.countByIdTreasureMissionProgressId(72L)).thenReturn(5L);
        when(items.findAllByIdTreasureMissionProgressIdOrderByIdItemIndexAsc(72L)).thenReturn(List.of(first, second));
        var place = location(8L, "다음", 10, 10);
        when(recommender.recommend(10, 10)).thenReturn(Optional.of(new NextLocationRecommender.RecommendedLocation(place, 42)));
        when(images.getLocationImageUrl(place.getContentId())).thenReturn("image.png");
        when(nextMissions.pick(8L)).thenReturn(Optional.of(mission(40L, MissionTypeCode.COOPERATIVE)));
        var response = stop();
        assertThat(response.missionProgressStatus()).isEqualTo("COMPLETED");
        assertThat(progress.getCompletedAt()).isEqualTo(LocalDateTime.now(CLOCK));
        assertThat(progress.getFoundItemCount()).isEqualTo(hasFound ? 1 : 0);
        assertThat(response.treasureCount()).isEqualTo(5);
        assertThat(response.foundTreasureIndexes()).isEqualTo(hasFound ? List.of(1) : List.of());
        assertThat(first.getItemStatus()).isEqualTo(hasFound ? TreasureItemStatus.FOUND : TreasureItemStatus.UNFOUND);
        assertThat(first.getFoundAt()).isEqualTo(hasFound ? COMPLETED_AT : null);
        assertThat(first.getLatitude()).isEqualTo(33.3);
        assertThat(first.getLongitude()).isEqualTo(126.3);
        assertThat(second.getItemStatus()).isEqualTo(TreasureItemStatus.UNFOUND);
        assertThat(second.getFoundAt()).isNull();
        assertThat(response.nextLocation().locationImageUrl()).isEqualTo("image.png");
        assertThat(response.nextLocation().mission()).isEqualTo(new StopTreasureMissionResponse.NextMission(40L, "COOPERATIVE"));
        verifyNoInteractions(rewards, coordinates, missions);
        verify(items, never()).saveAllAndFlush(any());
        verify(items, never()).deleteAllByProgressId(any());
    }

    @Test
    void 이미지와_연결미션이_없어도_장소객체를_반환한다() {
        found();
        when(recommender.recommend(10, 10)).thenReturn(Optional.of(
                new NextLocationRecommender.RecommendedLocation(location(8L, "다음", 10, 10), 0)));
        var response = stop();
        assertThat(response.nextLocation()).isNotNull();
        assertThat(response.nextLocation().locationImageUrl()).isNull();
        assertThat(response.nextLocation().mission()).isNull();
        assertThat(response.foundTreasureIndexes()).isEmpty();
        verifyNoInteractions(rewards, coordinates);
    }

    @Test
    void 추천없음은_추적정보를_포함해_실패하고_후속처리를_중단한다() {
        found();
        assertThatThrownBy(this::stop).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("userId=15", "progressId=72");
        verifyNoInteractions(items, nextMissions, images, rewards, coordinates);
    }

    /** 현재 사용자의 진행 중 기록을 준비한다. */
    private void found() {
        when(users.findById(15L)).thenReturn(Optional.of(user));
        when(progresses.findByIdAndUserIdAndMissionStatus(72L, 15L, MissionProgressStatus.IN_PROGRESS))
                .thenReturn(Optional.of(progress));
    }

    /** 고정 사용자 위치로 중단을 요청한다. */
    private StopTreasureMissionResponse stop() {
        return service.stopTreasureMission(15L, 72L, new StopTreasureMissionLocationRequest(10.0, 10.0));
    }

    /** 비즈니스 예외의 공개 코드를 확인한다. */
    private void error(String code) {
        assertThatThrownBy(this::stop).isInstanceOfSatisfying(BusinessException.class,
                exception -> assertThat(exception.getErrorCode().code()).isEqualTo(code));
    }
}
