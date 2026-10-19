package com.jamkkanjeju.server.domain.treasurehunt.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.home.support.HomeFixtures.*;
import static com.jamkkanjeju.server.domain.treasurehunt.support.TreasureMissionFixtures.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.common.client.BlobStorageClient;
import com.jamkkanjeju.server.common.image.ImageValidator;
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
import java.util.stream.IntStream;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** 발견·완료 분기와 지급 한도, 검증 실패 시 후속 처리 중단을 검증한다. */
@ExtendWith(MockitoExtension.class)
class SaveTreasureMissionProgressServiceTest {
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
                rewards, recommender, nextMissions, CLOCK,
                mock(PictureWithCharacterRepository.class), mock(ImageValidator.class), mock(BlobStorageClient.class));
        user = activeUser(15L);
        mission = treasureMission(31L, null, 8);
        progress = progress(user, mission);
    }

    @Test
    void 사용자없음은_모든후속처리를_중단한다() {
        error("UNAUTHORIZED", 1);
        verifyNoInteractions(progresses, items, rewards, recommender, images, coordinates);
    }

    @Test
    void 진행도없음은_아이템조회전에_거절한다() {
        when(users.findById(15L)).thenReturn(Optional.of(user));
        error("TREASURE_MISSION_PROGRESS_NOT_FOUND", 1);
        verifyNoInteractions(items, rewards, recommender, images);
    }

    @Test
    void 비활성은_기존진행도를_변경하지_않는다() {
        found();
        mission.changeStatus(MissionActivationStatus.INACTIVE);
        error("TREASURE_MISSION_INACTIVE", 1);
        assertThat(progress.getFoundItemCount()).isZero();
        verifyNoInteractions(items, rewards, recommender, images);
    }

    @Test
    void 없는아이템은_발견과_보상처리를_하지_않는다() {
        found();
        error("TREASURE_ITEM_NOT_FOUND", 99);
        verify(items).findById(new TreasureMissionProgressItemId(72L, 99));
        assertThat(progress.getFoundItemCount()).isZero();
        verifyNoInteractions(rewards, recommender, images);
    }

    @Test
    void 기발견아이템은_시각과_카운트를_유지한다() {
        found();
        var item = item(progress, 1, true);
        when(items.findById(new TreasureMissionProgressItemId(72L, 1))).thenReturn(Optional.of(item));
        error("TREASURE_ITEM_ALREADY_FOUND", 1);
        assertThat(item.getFoundAt()).isEqualTo(COMPLETED_AT);
        assertThat(progress.getFoundItemCount()).isZero();
        verifyNoInteractions(rewards, recommender, images);
    }

    @Test
    void 임의번호를_발견해도_전체COUNT와_정렬목록을_반환하고_한개만_지급한다() {
        var list = prepare(5, 4, false);
        var response = save(4);
        assertThat(response.treasureCount()).isEqualTo(5);
        assertThat(response.foundTreasureIndexes()).containsExactly(4);
        assertThat(response.nextLocation()).isNull();
        assertThat(response.reward()).isNotNull();
        assertThat(response.reward().point()).isNull();
        assertThat(progress.getFoundItemCount()).isEqualTo(1);
        assertThat(progress.getCompletedAt()).isNull();
        assertThat(list.get(3).getFoundAt()).isEqualTo(LocalDateTime.now(CLOCK));
        assertThat(list.get(3).getLatitude()).isEqualTo(33.3);
        assertThat(list.get(3).getLongitude()).isEqualTo(126.3);
        assertThat(list.getFirst().getItemStatus()).isEqualTo(TreasureItemStatus.UNFOUND);
        verify(rewards).grant(user, mission.getMission(), null, null, null, 1);
        verifyNoInteractions(recommender, nextMissions, images, coordinates);
        verify(items, never()).saveAllAndFlush(any());
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 4, 5})
    void 실제아이템_전체발견때만_완료하고_요청위치로_추천한다(int count) {
        prepare(count, count, true);
        when(recommender.recommend(10, 10)).thenReturn(Optional.of(
                new NextLocationRecommender.RecommendedLocation(location(8L, "다음", 10, 10), 0)));
        when(nextMissions.pick(8L)).thenReturn(Optional.of(mission(40L, MissionTypeCode.COOPERATIVE)));
        var response = save(count);
        assertThat(response.treasureCount()).isEqualTo(count);
        assertThat(response.foundTreasureIndexes()).hasSize(count);
        assertThat(response.missionProgressStatus()).isEqualTo("COMPLETED");
        assertThat(progress.getCompletedAt()).isEqualTo(LocalDateTime.now(CLOCK));
        assertThat(response.nextLocation().mission().id()).isEqualTo(40L);
        assertThat(response.nextLocation().mission().missionType()).isEqualTo("COOPERATIVE");
        assertThat(response.nextLocation().locationImageUrl()).isNull();
        assertThat(response.reward()).isEqualTo(new SaveTreasureMissionProgressResponse.Reward(null, null, null));
        verify(rewards).grant(user, mission.getMission(), null, null, null, 1);
    }

    @Test
    void 누적카운트가_전체수여도_미발견아이템이_있으면_완료하지_않는다() {
        prepare(4, 1, false);
        for (int i = 0; i < 3; i++) progress.increaseFoundItemCount();
        assertThat(save(1).missionProgressStatus()).isEqualTo("IN_PROGRESS");
        verifyNoInteractions(recommender, nextMissions, images);
    }

    @Test
    void 보상실패는_추천전에_전파한다() {
        prepare(1, 1, false);
        when(rewards.grant(user, mission.getMission(), null, null, null, 1)).thenThrow(new IllegalStateException("보상 실패"));
        assertThatThrownBy(() -> save(1)).hasMessage("보상 실패");
        verifyNoInteractions(recommender, nextMissions, images);
    }

    @Test
    void 필수추천없음은_추적정보가_있는_실패를_전파한다() {
        prepare(1, 1, false);
        assertThatThrownBy(() -> save(1)).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("userId=15", "progressId=72");
        verifyNoInteractions(nextMissions, images);
    }

    /** 유효한 사용자 소유 진행도를 준비한다. */
    private void found() {
        when(users.findById(15L)).thenReturn(Optional.of(user));
        when(progresses.findByIdAndUserIdAndMissionStatus(72L, 15L, MissionProgressStatus.IN_PROGRESS))
                .thenReturn(Optional.of(progress));
    }

    /** 고정 아이템 목록과 이번 발견 대상을 준비한다. */
    private List<TreasureMissionProgressItem> prepare(int count, int target, boolean foundOthers) {
        found();
        var list = IntStream.rangeClosed(1, count).mapToObj(index -> item(progress, index, foundOthers && index != target)).toList();
        if (foundOthers) for (int i = 1; i < count; i++) progress.increaseFoundItemCount();
        when(items.findById(new TreasureMissionProgressItemId(72L, target))).thenReturn(Optional.of(list.get(target - 1)));
        when(items.countByIdTreasureMissionProgressId(72L)).thenReturn((long) count);
        when(items.findAllByIdTreasureMissionProgressIdOrderByIdItemIndexAsc(72L)).thenReturn(list);
        lenient().when(rewards.grant(user, mission.getMission(), null, null, null, 1)).thenReturn(MissionRewardGranter.GrantedReward.NONE);
        return list;
    }

    /** 프론트 판정이므로 보물에서 멀리 떨어진 좌표로도 요청한다. */
    private SaveTreasureMissionProgressResponse save(int index) {
        return service.saveTreasureMissionProgress(15L, 72L,
                new SaveTreasureMissionProgressLocationRequest(10.0, 10.0), new SaveTreasureMissionProgressRequest(index));
    }

    /** 도메인 오류 코드와 타입을 확인한다. */
    private void error(String code, int index) {
        assertThatThrownBy(() -> save(index)).isInstanceOfSatisfying(BusinessException.class,
                error -> assertThat(error.getErrorCode().code()).isEqualTo(code));
    }
}
