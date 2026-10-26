package com.jamkkanjeju.server.domain.map.service;

import static com.jamkkanjeju.server.domain.map.support.MapLocationDetailFixtures.*;
import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.user;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.repository.*;
import com.jamkkanjeju.server.domain.guestbook.entity.GuestbookStatus;
import com.jamkkanjeju.server.domain.guestbook.repository.*;
import com.jamkkanjeju.server.domain.home.repository.AcquiredCouponRepository;
import com.jamkkanjeju.server.domain.map.dto.*;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.exception.MapErrorCode;
import com.jamkkanjeju.server.domain.map.repository.*;
import com.jamkkanjeju.server.domain.map.service.NearbyMissionRecommender.RecommendedMission;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.mission.service.MissionCompletionChecker;
import com.jamkkanjeju.server.domain.treasurehunt.entity.*;
import com.jamkkanjeju.server.domain.treasurehunt.repository.*;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.SliceImpl;

/** 상세 서비스의 공개 응답 조합·페이지·기지급 보상·사전 오류를 검증한다. */
@ExtendWith(MockitoExtension.class)
class GetMapLocationDetailServiceTest {
    @Mock UserRepository users;
    @Mock LocationRepository locations;
    @Mock RoadGuestbookRepository roads;
    @Mock LocationGuestbookRepository books;
    @Mock TreasureMissionRepository treasures;
    @Mock CooperativeMissionRepository cooperatives;
    @Mock TreasureMissionProgressRepository progresses;
    @Mock CooperativeMissionParticipantRepository participants;
    @Mock AcquiredCouponRepository coupons;
    @Spy MissionCompletionChecker completion = new MissionCompletionChecker();
    @Spy TravelEstimator travel = new TravelEstimator();
    @Mock TourApiClient images;
    @Mock VisitedLocationRepository visits;
    @Mock MissionRewardStatusRepository rewards;
    @Mock NearbyMissionRecommender recommender;
    @InjectMocks MapService service;
    User user;
    Location location;
    GetMapLocationDetailRequest request = new GetMapLocationDetailRequest(0.0, 0.0, 1, 20);

    @BeforeEach
    void setup() {
        user = user(15L, "detail-service@example.com");
        location = locationAt(39L, 0);
        when(users.findById(15L)).thenReturn(Optional.of(user));
    }

    private void found(boolean hasNext) {
        when(locations.findById(39L)).thenReturn(Optional.of(location));
        when(books.findSliceByLocationIdAndStatus(39L, GuestbookStatus.ACTIVE, PageRequest.of(1, 20)))
                .thenReturn(new SliceImpl<>(List.of(), PageRequest.of(1, 20), hasNext));
    }

    private GetMapLocationDetailResponse get() { return service.getMapLocationDetail(15L, 39L, request); }

    @Test
    void 사용자없으면_대상과_외부정보를_조회하지_않는다() {
        when(users.findById(15L)).thenReturn(Optional.empty());
        assertThatThrownBy(this::get).isInstanceOf(BusinessException.class).extracting("errorCode")
                .isEqualTo(CommonErrorCode.UNAUTHORIZED);
        verifyNoInteractions(locations, recommender, images, books);
    }

    @Test
    void 장소없으면_404이며_후속조회를_중단한다() {
        assertThatThrownBy(this::get).isInstanceOf(BusinessException.class).extracting("errorCode")
                .isEqualTo(MapErrorCode.LOCATION_NOT_FOUND);
        verifyNoInteractions(recommender, images, books, visits, rewards);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void 빈_부가정보를_허용하고_요청페이지와_hasNext를_그대로_전달한다(boolean hasNext) {
        found(hasNext);
        GetMapLocationDetailResponse response = get();
        assertThat(response.locationDescription()).isNull();
        assertThat(response.locationImageUrls()).isNull();
        assertThat(response.nearbyMissions()).isEmpty();
        assertThat(response.locationMission()).isNull();
        assertThat(response.guestbooksPage()).isEqualTo(new GetMapLocationDetailResponse.GuestbooksPage(1, 20, hasNext));
        verify(images).getLocationDetailImageUrls(location.getContentId(), 5);
        verify(rewards, never()).save(any());
        verify(visits, never()).save(any());
        verify(users, never()).save(any());
    }

    @Test
    void 선정된_두유형만_보상과_이미지를_읽고_순서를_유지한다() {
        found(false);
        TreasureMission treasure = treasure(31L, 1);
        CooperativeMission cooperative = cooperative(32L, 2);
        when(recommender.recommend(15L, 0, 0)).thenReturn(List.of(
                new RecommendedMission(cooperative.getMission(), cooperative.getLocation(), 1),
                new RecommendedMission(treasure.getMission(), treasure.getLocation(), 2)));
        when(treasures.findAllWithRewardsByMissionIdIn(List.of(31L))).thenReturn(List.of(treasure));
        when(cooperatives.findAllWithRewardsByMissionIdIn(List.of(32L))).thenReturn(List.of(cooperative));
        MissionRewardStatus saved = MissionRewardStatus.builder().mission(treasure.getMission()).user(user).build();
        saved.grantArCharacterReward();
        when(rewards.findAllByIdUserIdAndIdMissionIdIn(15L, List.of(32L, 31L))).thenReturn(List.of(saved));
        when(images.getLocationImageUrl(anyLong())).thenAnswer(invocation ->
                treasure.getLocation().getContentId().equals(invocation.getArgument(0)) ? "treasure.jpg" : null);
        GetMapLocationDetailResponse response = get();
        assertThat(response.nearbyMissions()).extracting(GetMapLocationDetailResponse.NearbyMissionInfo::missionId)
                .containsExactly(32L, 31L);
        assertThat(response.nearbyMissions().get(1).rewardDetail().arCharacter().isReceived()).isTrue();
        assertThat(response.nearbyMissions().get(1).rewardDetail().point().isReceived()).isFalse();
        assertThat(response.nearbyMissions().get(1).representativeImageUrl()).isEqualTo("treasure.jpg");
        verify(images, times(2)).getLocationImageUrl(anyLong());
        verify(rewards, never()).findById(any());
    }

    @Test
    void 완료된_현재장소미션도_전체보상을_유지한다() {
        found(false);
        TreasureMission mission = treasure(31L, 0);
        when(treasures.findAllWithRewardsByLocationIdAndStatus(39L, MissionActivationStatus.ACTIVE)).thenReturn(List.of(mission));
        when(progresses.findByUserIdAndTreasureMissionMissionId(15L, 31L))
                .thenReturn(Optional.of(TreasureMissionProgress.builder().treasureMission(mission)
                        .missionStatus(MissionProgressStatus.COMPLETED).build()));
        MissionRewardStatus status = MissionRewardStatus.builder().mission(mission.getMission()).user(user).build();
        status.grantArCharacterReward(); status.grantPointReward(); status.grantCouponReward();
        when(rewards.findById(new MissionRewardStatusId(31L, 15L))).thenReturn(Optional.of(status));
        GetMapLocationDetailResponse response = get();
        assertThat(response.locationMission().isCompleted()).isTrue();
        assertThat(response.locationMission().rewardDetail().point().amount()).isEqualTo(100);
        assertThat(response.locationMission().rewardDetail().point().isReceived()).isTrue();
        verify(rewards, never()).save(any());
    }

    @Test
    void 현재미션이_추천에도_있으면_지급상태를_다시조회하지_않는다() {
        found(false);
        CooperativeMission mission = cooperative(32L, 0);
        when(recommender.recommend(15L, 0, 0)).thenReturn(List.of(new RecommendedMission(mission.getMission(), location, 0)));
        when(cooperatives.findAllWithRewardsByMissionIdIn(List.of(32L))).thenReturn(List.of(mission));
        when(cooperatives.findAllWithRewardsByLocationIdAndStatus(39L, MissionActivationStatus.ACTIVE)).thenReturn(List.of(mission));
        GetMapLocationDetailResponse response = get();
        assertThat(response.locationMission().missionId()).isEqualTo(32L);
        verify(rewards, never()).findById(any());
    }

    @Test
    void 활성미션중복은_예외로_전달한다() {
        found(false);
        TreasureMission mission = treasure(31L, 0);
        when(treasures.findAllWithRewardsByLocationIdAndStatus(39L, MissionActivationStatus.ACTIVE))
                .thenReturn(List.of(mission, mission));
        assertThatThrownBy(this::get).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void DB조회실패를_장소없음으로_바꾸지_않는다() {
        when(locations.findById(39L)).thenThrow(new IllegalStateException("DB failure"));
        assertThatThrownBy(this::get).isInstanceOf(IllegalStateException.class).hasMessage("DB failure");
    }
}
