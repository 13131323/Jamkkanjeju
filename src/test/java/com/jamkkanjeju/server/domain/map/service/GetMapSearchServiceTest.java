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
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.repository.*;
import com.jamkkanjeju.server.domain.guestbook.repository.*;
import com.jamkkanjeju.server.domain.home.repository.AcquiredCouponRepository;
import com.jamkkanjeju.server.domain.map.dto.*;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.repository.*;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.mission.service.MissionCompletionChecker;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
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
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.SliceImpl;

/** 검색 페이지의 조합·조회 범위·실패 시 중단과 쓰기 없는 흐름을 검증한다. */
@ExtendWith({MockitoExtension.class, OutputCaptureExtension.class})
class GetMapSearchServiceTest {
    @Mock UserRepository users;
    @Mock LocationRepository locations;
    @Mock RoadGuestbookRepository roads;
    @Mock LocationGuestbookRepository books;
    @Mock TreasureMissionRepository treasures;
    @Mock CooperativeMissionRepository cooperatives;
    @Mock TreasureMissionProgressRepository progresses;
    @Mock CooperativeMissionParticipantRepository participants;
    @Mock AcquiredCouponRepository coupons;
    @Mock MissionCompletionChecker completion;
    @Spy TravelEstimator travel = new TravelEstimator();
    @Mock TourApiClient images;
    @Mock VisitedLocationRepository visits;
    @Mock MissionRewardStatusRepository rewards;
    @Mock NearbyMissionRecommender recommender;
    @InjectMocks MapService service;
    GetMapSearchRequest request = new GetMapSearchRequest(" 제주 카 ", 0.0, 0.0, 1, 2);

    @BeforeEach
    void setup() { when(users.findById(15L)).thenReturn(Optional.of(user(15L, "search@example.com"))); }

    private void page(List<Location> items, boolean hasNext) {
        when(locations.findByTitleContainingOrderByIdAsc("제주 카", PageRequest.of(1, 2)))
                .thenReturn(new SliceImpl<>(items, PageRequest.of(1, 2), hasNext));
    }

    private GetMapSearchResponse get() { return service.getMapSearch(15L, request); }

    @Test
    void 사용자없으면_검색과_후속조회를_중단한다() {
        when(users.findById(15L)).thenReturn(Optional.empty());
        assertThatThrownBy(this::get).isInstanceOf(BusinessException.class).extracting("errorCode")
                .isEqualTo(CommonErrorCode.UNAUTHORIZED);
        verifyNoInteractions(locations, treasures, cooperatives, images, travel);
    }

    @Test
    void 빈페이지는_요청크기를_유지하고_후속처리를_생략한다() {
        page(List.of(), false);
        GetMapSearchResponse response = get();
        assertThat(response.locations()).isEmpty();
        assertThat(response.locationsPage()).isEqualTo(new GetMapSearchResponse.LocationsPage(1, 2, false));
        verifyNoInteractions(treasures, cooperatives, images, travel);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void 현재페이지의_두유형미션만_조합하고_거리와무관하게_조회순서를_유지한다(boolean hasNext) {
        TreasureMission treasure = treasure(31L, 2);
        CooperativeMission cooperative = cooperative(32L, 1);
        page(List.of(treasure.getLocation(), cooperative.getLocation()), hasNext);
        List<Long> ids = List.of(31L, 32L);
        when(treasures.findAllByLocationIdInAndStatus(ids, MissionActivationStatus.ACTIVE)).thenReturn(List.of(treasure));
        when(cooperatives.findAllByLocationIdInAndStatus(ids, MissionActivationStatus.ACTIVE)).thenReturn(List.of(cooperative));
        when(images.getLocationImageUrl(treasure.getLocation().getContentId())).thenReturn("treasure.jpg");
        GetMapSearchResponse response = get();
        assertThat(response.locations()).extracting(GetMapSearchResponse.LocationInfo::locationId).containsExactly(31L, 32L);
        assertThat(response.locations().getFirst().distanceMeter()).isGreaterThan(response.locations().getLast().distanceMeter());
        assertThat(response.locations().getFirst().mission().missionType()).isEqualTo("TREASURE");
        assertThat(response.locations().getLast().mission().missionId()).isEqualTo(32L);
        assertThat(response.locations().getLast().mission().missionType()).isEqualTo("COOPERATIVE");
        assertThat(response.locations().getFirst().representativeImageUrl()).isEqualTo("treasure.jpg");
        assertThat(response.locations().getLast().representativeImageUrl()).isNull();
        assertThat(response.locationsPage().hasNext()).isEqualTo(hasNext);
        verify(images, times(2)).getLocationImageUrl(anyLong());
        verifyNoInteractions(progresses, participants, completion, rewards, roads, books, visits, coupons, recommender);
        verify(users, never()).save(any());
        verify(locations, never()).save(any());
    }

    @Test
    void 동일contentId는_한번만_조회하고_미션없어도_장소를_유지한다() {
        Location first = locationAt(39L, 0);
        Location second = Location.builder().id(40L).contentId(first.getContentId()).title("다른 장소")
                .category("관광지").latitude(0).longitude(1).build();
        page(List.of(first, second), false);
        GetMapSearchResponse response = get();
        assertThat(response.locations()).hasSize(2).allSatisfy(item -> {
            assertThat(item.mission()).isNull();
            assertThat(item.representativeImageUrl()).isNull();
        });
        verify(images).getLocationImageUrl(first.getContentId());
        verifyNoMoreInteractions(images);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void 같은유형과_다른유형중복은_로그와_예외로_전달하고_이미지를_읽지않는다(boolean mixed, CapturedOutput output) {
        TreasureMission first = treasure(31L, 0);
        page(List.of(first.getLocation()), false);
        if (mixed) {
            CooperativeMission second = CooperativeMission.builder().mission(mission(32L,
                    com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode.COOPERATIVE))
                    .location(first.getLocation()).build();
            when(treasures.findAllByLocationIdInAndStatus(List.of(31L), MissionActivationStatus.ACTIVE)).thenReturn(List.of(first));
            when(cooperatives.findAllByLocationIdInAndStatus(List.of(31L), MissionActivationStatus.ACTIVE)).thenReturn(List.of(second));
        } else {
            TreasureMission second = TreasureMission.builder().mission(mission(32L,
                    com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode.TREASURE)).location(first.getLocation()).build();
            when(treasures.findAllByLocationIdInAndStatus(List.of(31L), MissionActivationStatus.ACTIVE)).thenReturn(List.of(first, second));
        }
        assertThatThrownBy(this::get).isInstanceOf(IllegalStateException.class);
        assertThat(output.getOut()).contains("locationId=31", "31:TREASURE", mixed ? "32:COOPERATIVE" : "32:TREASURE");
        verifyNoInteractions(images, travel);
    }

    @Test
    void DB실패를_빈결과로_숨기지않는다() {
        when(locations.findByTitleContainingOrderByIdAsc(anyString(), any())).thenThrow(new IllegalStateException("DB failure"));
        assertThatThrownBy(this::get).isInstanceOf(IllegalStateException.class).hasMessage("DB failure");
        verifyNoInteractions(treasures, cooperatives, images, travel);
    }
}
