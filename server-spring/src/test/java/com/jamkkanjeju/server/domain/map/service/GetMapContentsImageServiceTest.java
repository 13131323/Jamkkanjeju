package com.jamkkanjeju.server.domain.map.service;

import static com.jamkkanjeju.server.domain.map.support.MapLocationDetailFixtures.*;
import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.user;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.common.client.LocationImageCache;
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

/** 지도 홈은 외부 사진 완료를 기다리는 경로를 호출하지 않는다. */
@ExtendWith(MockitoExtension.class)
class GetMapContentsImageServiceTest {
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
    @Mock LocationImageCache cachedImages;
    @Mock VisitedLocationRepository visits;
    @Mock MissionRewardStatusRepository rewards;
    @Mock NearbyMissionRecommender recommender;
    @InjectMocks MapService service;

    @Test void cacheMissReturnsNullAndPendingLocationIdWithoutBlockingLookup() {
        Location place = locationAt(31L, 0);
        when(users.findById(15L)).thenReturn(Optional.of(user(15L, "async-map@example.com")));
        when(locations.findAllByLatitudeBetweenAndLongitudeBetween(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(place));
        when(cachedImages.needsImageRefresh(place.getContentId())).thenReturn(true);
        var response = (GetMapContentsResponse) service.getMapContents(15L,
                new GetMapContentsRequest(1.0, -1.0, -1.0, 1.0, 0.0, 0.0, false));
        assertThat(response.locations()).hasSize(1);
        assertThat(response.locations().getFirst().representativeImageUrl()).isNull();
        assertThat(response.pendingLocationImageIds()).containsExactly(31L);
        verify(cachedImages).getCachedLocationImageUrl(place.getContentId());
        verify(cachedImages, never()).getLocationImageUrl(anyLong());
        verifyNoInteractions(images);
    }

    @Test void readyImageReturnsWithoutPendingOrExternalLookup() {
        Location place = locationAt(31L, 0);
        when(users.findById(15L)).thenReturn(Optional.of(user(15L, "async-map@example.com")));
        when(locations.findAllByLatitudeBetweenAndLongitudeBetween(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(place));
        when(cachedImages.getCachedLocationImageUrl(place.getContentId())).thenReturn("cached.jpg");
        var response = (GetMapContentsResponse) service.getMapContents(15L,
                new GetMapContentsRequest(1.0, -1.0, -1.0, 1.0, 0.0, 0.0, false));
        assertThat(response.locations().getFirst().representativeImageUrl()).isEqualTo("cached.jpg");
        assertThat(response.pendingLocationImageIds()).isEmpty();
        verify(cachedImages, never()).getLocationImageUrl(anyLong());
        verifyNoInteractions(images);
    }
}
