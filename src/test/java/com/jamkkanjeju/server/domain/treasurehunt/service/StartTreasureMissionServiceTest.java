package com.jamkkanjeju.server.domain.treasurehunt.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.*;
import static com.jamkkanjeju.server.domain.treasurehunt.support.TreasureMissionFixtures.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.map.service.NextLocationRecommender;
import com.jamkkanjeju.server.domain.mission.service.MissionRewardGranter;
import com.jamkkanjeju.server.domain.mission.service.NextMissionSelector;
import com.jamkkanjeju.server.domain.treasurehunt.dto.StartTreasureMissionLocationRequest;
import com.jamkkanjeju.server.domain.treasurehunt.entity.*;
import com.jamkkanjeju.server.domain.treasurehunt.repository.*;
import java.util.List;
import java.util.Optional;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/** 외부 협력 객체를 격리해 시작·재사용·실패 분기와 응답 구성을 검증한다. */
@ExtendWith(MockitoExtension.class)
class StartTreasureMissionServiceTest {
    @Mock UserRepository users;
    @Mock TreasureMissionRepository missions;
    @Mock TreasureMissionProgressRepository progresses;
    @Mock TreasureMissionProgressItemRepository items;
    @Mock TreasureItemCoordinateGenerator coordinates;
    @Mock TourApiClient tourApi;
    @Mock MissionRewardGranter rewards;
    @Mock NextLocationRecommender recommender;
    @Mock NextMissionSelector nextMissions;
    TreasureMissionService service;
    final StartTreasureMissionLocationRequest request = new StartTreasureMissionLocationRequest(33.3, 126.3);
    final com.jamkkanjeju.server.domain.auth.entity.User user = activeUser(15L);
    TreasureMission mission;

    @BeforeEach
    void setUp() {
        mission = treasureMission(31L, null, 8);
        service = new TreasureMissionService(users, missions, progresses, items, coordinates, tourApi,
                rewards, recommender, nextMissions, Clock.fixed(Instant.parse("2026-10-16T03:00:00Z"), ZoneOffset.UTC));
    }

    @Test
    void 사용자_없음은_후속조회를_중단한다() {
        assertError("UNAUTHORIZED");
        verifyNoInteractions(missions, progresses, items, coordinates, tourApi);
    }

    @Test
    void 미션_없음은_변경을_중단한다() {
        when(users.findById(15L)).thenReturn(Optional.of(user));
        assertError("TREASURE_MISSION_NOT_FOUND");
        verifyNoInteractions(progresses, items, coordinates, tourApi);
    }

    @Test
    void 비활성_미션은_진행도조회_전에_거절한다() {
        ready();
        mission.changeStatus(MissionActivationStatus.INACTIVE);
        assertError("TREASURE_MISSION_INACTIVE");
        verifyNoInteractions(progresses, items, coordinates, tourApi);
    }

    @Test
    void 최초_시작은_ID확보_후_고정좌표_3개를_저장한다() {
        ready();
        when(progresses.saveAndFlush(any())).thenAnswer(invocation -> {
            TreasureMissionProgress progress = invocation.getArgument(0);
            ReflectionTestUtils.setField(progress, "id", 72L);
            assertThat(progress.getUser()).isSameAs(user);
            assertThat(progress.getTreasureMission()).isSameAs(mission);
            assertThat(progress.getFoundItemCount()).isZero();
            assertThat(progress.getCompletedAt()).isNull();
            return progress;
        });
        generate();
        when(items.saveAllAndFlush(any())).thenAnswer(invocation -> {
            List<TreasureMissionProgressItem> saved = invocation.getArgument(0);
            assertThat(saved).extracting(TreasureMissionProgressItem::getItemIndex).containsExactly(1, 2, 3);
            assertThat(saved).allSatisfy(item -> {
                assertThat(item.getId().getTreasureMissionProgressId()).isEqualTo(72L);
                assertThat(item.getLatitude()).isEqualTo(33.3);
                assertThat(item.getLongitude()).isEqualTo(126.3);
                assertThat(item.getItemStatus()).isEqualTo(TreasureItemStatus.UNFOUND);
                assertThat(item.getFoundAt()).isNull();
            });
            return saved;
        });
        when(items.countByIdTreasureMissionProgressId(72L)).thenReturn(3L);
        var response = service.startTreasureMission(15L, 31L, request);
        assertThat(response.created()).isTrue();
        assertThat(response.treasureCount()).isEqualTo(3);
        assertThat(mission.getItemTotalCount()).isEqualTo(8);
        var order = inOrder(progresses, coordinates, items);
        order.verify(progresses).saveAndFlush(any());
        order.verify(coordinates).generate(33.3, 126.3);
        order.verify(items).saveAllAndFlush(any());
        verifyNoInteractions(tourApi);
    }

    @Test
    void 이어하기는_기존값을_유지하고_실제_COUNT를_사용한다() {
        ready();
        var progress = progress(user, mission);
        progress.increaseFoundItemCount();
        when(progresses.findByUserIdAndTreasureMissionMissionId(15L, 31L)).thenReturn(Optional.of(progress));
        when(items.countByIdTreasureMissionProgressId(72L)).thenReturn(5L);
        when(items.findAllByIdTreasureMissionProgressIdOrderByIdItemIndexAsc(72L))
                .thenReturn(java.util.stream.IntStream.rangeClosed(1, 5)
                        .mapToObj(index -> item(progress, index, index == 1)).toList());
        var response = service.startTreasureMission(15L, 31L, request);
        assertThat(response.created()).isFalse();
        assertThat(response.treasureCount()).isEqualTo(5);
        assertThat(progress.getFoundItemCount()).isEqualTo(1);
        assertThat(response.treasureItems().getFirst().isFound()).isTrue();
        verifyNoInteractions(coordinates, tourApi);
        verify(items, never()).deleteAllByProgressId(any());
        verify(items, never()).saveAllAndFlush(any());
        verify(progresses, never()).saveAndFlush(any());
    }

    @Test
    void 재시작은_삭제_후_같은_ID의_초기화된_진행도에_보물을_저장한다() {
        ready();
        var progress = progress(user, mission);
        progress.increaseFoundItemCount();
        progress.complete(COMPLETED_AT);
        when(progresses.findByUserIdAndTreasureMissionMissionId(15L, 31L)).thenReturn(Optional.of(progress));
        generate();
        doAnswer(invocation -> {
            assertThat(progress.getMissionStatus().name()).isEqualTo("IN_PROGRESS");
            assertThat(progress.getFoundItemCount()).isZero();
            assertThat(progress.getCompletedAt()).isNull();
            return invocation.getArgument(0);
        }).when(items).saveAllAndFlush(any());
        var response = service.startTreasureMission(15L, 31L, request);
        assertThat(response.treasureMissionProgressId()).isEqualTo(72L);
        assertThat(response.created()).isFalse();
        var order = inOrder(items, coordinates);
        order.verify(items).deleteAllByProgressId(72L);
        order.verify(coordinates).generate(33.3, 126.3);
        order.verify(items).saveAllAndFlush(any());
        verify(progresses, never()).saveAndFlush(any());
    }

    @ParameterizedTest
    @CsvSource(value = {"첫 문장. 둘째!|첫 문장.", "처음! 다음.|처음!", "질문? 대답.|질문?", "종결 없음|종결 없음", "NULL|NULL", "'   '|NULL"}, delimiter = '|', nullValues = "NULL")
    void 장소설명은_첫문장이고_없으면_null이다(String overview, String expected) {
        ready();
        ReflectionTestUtils.setField(mission, "location", location(8L, "장소", 30, 120));
        var progress = progress(user, mission);
        when(progresses.findByUserIdAndTreasureMissionMissionId(15L, 31L)).thenReturn(Optional.of(progress));
        when(tourApi.getLocationOverview(8L)).thenReturn(overview);
        var response = service.startTreasureMission(15L, 31L, request);
        assertThat(response.location().locationDescription()).isEqualTo(expected);
        assertThat(response.location().locationTitle()).isEqualTo("장소");
        verify(tourApi).getLocationOverview(8L);
    }

    @Test
    void 진행도저장_실패는_전파하고_아이템을_만들지_않는다() {
        ready();
        when(progresses.saveAndFlush(any())).thenThrow(new IllegalStateException("저장 실패"));
        assertThatThrownBy(() -> service.startTreasureMission(15L, 31L, request)).hasMessage("저장 실패");
        verifyNoInteractions(coordinates, items, tourApi);
    }

    @Test
    void 아이템저장_실패는_응답조회_없이_전파한다() {
        ready();
        when(progresses.saveAndFlush(any())).thenReturn(progress(user, mission));
        generate();
        when(items.saveAllAndFlush(any())).thenThrow(new IllegalStateException("아이템 실패"));
        assertThatThrownBy(() -> service.startTreasureMission(15L, 31L, request)).hasMessage("아이템 실패");
        verify(items, never()).countByIdTreasureMissionProgressId(any());
        verifyNoInteractions(tourApi);
    }

    /** 사용자·활성 미션 조회를 준비한다. */
    private void ready() {
        when(users.findById(15L)).thenReturn(Optional.of(user));
        when(missions.findByMissionId(31L)).thenReturn(Optional.of(mission));
    }

    /** 난수 대신 고정된 세 좌표를 반환한다. */
    private void generate() {
        when(coordinates.generate(33.3, 126.3)).thenReturn(java.util.Collections.nCopies(3,
                new TreasureItemCoordinateGenerator.Coordinate(33.3, 126.3)));
    }

    /** 실패 시 도메인 코드가 일치하는지 확인한다. */
    private void assertError(String code) {
        assertThatThrownBy(() -> service.startTreasureMission(15L, 31L, request))
                .isInstanceOfSatisfying(BusinessException.class, error -> assertThat(error.getErrorCode().code()).isEqualTo(code));
    }
}
