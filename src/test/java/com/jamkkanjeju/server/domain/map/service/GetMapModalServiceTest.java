package com.jamkkanjeju.server.domain.map.service;

import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.*;
import static com.jamkkanjeju.server.domain.mission.support.MissionFixtures.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.repository.*;
import com.jamkkanjeju.server.domain.guestbook.entity.*;
import com.jamkkanjeju.server.domain.guestbook.repository.*;
import com.jamkkanjeju.server.domain.home.repository.AcquiredCouponRepository;
import com.jamkkanjeju.server.domain.map.dto.*;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.exception.MapErrorCode;
import com.jamkkanjeju.server.domain.map.repository.*;
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
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

/** 지도 모달의 조회 분기·완료 판정·오류 중단과 조회 전용 동작을 검증한다. */
@ExtendWith({MockitoExtension.class, OutputCaptureExtension.class})
class GetMapModalServiceTest {
    @Mock UserRepository users;
    @Mock LocationRepository locations;
    @Mock RoadGuestbookRepository roads;
    @Mock LocationGuestbookRepository books;
    @Mock TreasureMissionRepository treasures;
    @Mock CooperativeMissionRepository cooperatives;
    @Mock TreasureMissionProgressRepository treasureProgresses;
    @Mock CooperativeMissionParticipantRepository participants;
    @Mock AcquiredCouponRepository coupons;
    @Spy MissionCompletionChecker completion = new MissionCompletionChecker();
    @Spy TravelEstimator travel = new TravelEstimator();
    @Mock TourApiClient images;
    @Mock VisitedLocationRepository visits;
    @Mock MissionRewardStatusRepository rewards;
    @InjectMocks MapService service;
    User user;
    Location location;

    @BeforeEach
    void setup() {
        user = user(15L, "service@example.com");
        location = location(39L, 990008L);
        when(users.findById(15L)).thenReturn(Optional.of(user));
    }

    private GetMapModalRequest request(String type) { return new GetMapModalRequest(type, 39L, 33.45, 126.92); }

    private void foundLocation() { when(locations.findById(39L)).thenReturn(Optional.of(location)); }

    private TreasureMission treasure() {
        TreasureMission mission = TreasureMission.builder().mission(mission(MissionTypeCode.TREASURE))
                .location(location).status(MissionActivationStatus.ACTIVE).itemTotalCount(3)
                .arCharacter(character()).point(100).coupon(coupon(true)).build();
        when(treasures.findAllWithRewardsByLocationIdAndStatus(39L, MissionActivationStatus.ACTIVE))
                .thenReturn(List.of(mission));
        return mission;
    }

    @Test
    void 사용자_없으면_대상을_조회하지_않는다() {
        when(users.findById(15L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getMapModal(15L, request("LOCATION")))
                .isInstanceOf(BusinessException.class).extracting("errorCode").isEqualTo(CommonErrorCode.UNAUTHORIZED);
        verifyNoInteractions(locations, roads, images, rewards);
    }

    @ParameterizedTest
    @ValueSource(strings = {"LOCATION", "ROAD_GUESTBOOK"})
    void 대상_없으면_다른_유형으로_대체하지_않는다(String type) {
        assertThatThrownBy(() -> service.getMapModal(15L, request(type)))
                .isInstanceOf(BusinessException.class).extracting("errorCode")
                .isEqualTo(MapErrorCode.MAP_MODAL_TARGET_NOT_FOUND);
        if (type.equals("LOCATION")) verifyNoInteractions(roads);
        else verifyNoInteractions(locations);
        verifyNoInteractions(images, rewards, books, treasures, cooperatives);
    }

    @Test
    void 미션과_이미지_없어도_장소_응답을_유지하며_저장하지_않는다() {
        foundLocation();
        GetLocationMapModalResponse result = (GetLocationMapModalResponse) service.getMapModal(15L, request("LOCATION"));
        assertThat(result.id()).isEqualTo(39L);
        assertThat(result.mission()).isNull();
        assertThat(result.representativeImageUrl()).isNull();
        assertThat(result.distanceMeter()).isZero();
        assertThat(result.durationMinutes()).isZero();
        assertThat(result.guestbooksCount()).isZero();
        assertThat(result.guestbooks()).isEmpty();
        verifyNoInteractions(rewards, treasureProgresses, participants, roads);
        verify(visits, never()).save(any());
        verify(rewards, never()).save(any());
        verify(users, never()).save(any());
    }

    @ParameterizedTest
    @CsvSource({"IN_PROGRESS,false", "COMPLETED,true"})
    void 보물찾기_완료는_지급_상태와_별도로_판정한다(MissionProgressStatus status, boolean completed) {
        foundLocation();
        TreasureMission mission = treasure();
        when(treasureProgresses.findByUserIdAndTreasureMissionMissionId(15L, 31L))
                .thenReturn(Optional.of(TreasureMissionProgress.builder().treasureMission(mission)
                        .user(user).missionStatus(status).build()));
        MissionRewardStatus reward = MissionRewardStatus.builder().mission(mission.getMission()).user(user).build();
        reward.grantArCharacterReward();
        when(rewards.findById(new MissionRewardStatusId(31L, 15L))).thenReturn(Optional.of(reward));
        GetLocationMapModalResponse response = (GetLocationMapModalResponse) service.getMapModal(15L, request("LOCATION"));
        assertThat(response.mission().isCompleted()).isEqualTo(completed);
        assertThat(response.mission().rewardDetail().arCharacter().isReceived()).isTrue();
        assertThat(response.mission().rewardDetail().point().isReceived()).isFalse();
        verify(rewards).findById(new MissionRewardStatusId(31L, 15L));
        verify(rewards, never()).save(any());
    }

    @Test
    void 보물찾기_이력과_보상_상태가_없으면_미완료_미수령이다() {
        foundLocation();
        treasure();
        GetLocationMapModalResponse response = (GetLocationMapModalResponse) service.getMapModal(15L, request("LOCATION"));
        assertThat(response.mission().isCompleted()).isFalse();
        assertThat(response.mission().rewardDetail().arCharacter().isReceived()).isFalse();
        assertThat(response.mission().rewardDetail().coupon().isReceived()).isFalse();
    }

    @ParameterizedTest
    @CsvSource({"PENDING,IN_PROGRESS,false", "PENDING,COMPLETED,false", "ACCEPTED,IN_PROGRESS,false", "ACCEPTED,COMPLETED,true"})
    void 협동_완료는_참가_상태와_팀_진행도를_함께_확인한다(
            ParticipantStatus status, MissionProgressStatus progressStatus, boolean completed) {
        foundLocation();
        CooperativeMission mission = CooperativeMission.builder().mission(mission(MissionTypeCode.COOPERATIVE))
                .location(location).status(MissionActivationStatus.ACTIVE).build();
        when(cooperatives.findAllWithRewardsByLocationIdAndStatus(39L, MissionActivationStatus.ACTIVE))
                .thenReturn(List.of(mission));
        CooperativeMissionProgress progress = CooperativeMissionProgress.builder().cooperativeMission(mission)
                .missionStatus(progressStatus).teamToken("unit-team").build();
        when(participants.findAllByUserIdAndMissionId(15L, 31L)).thenReturn(List.of(
                CooperativeMissionParticipant.builder().cooperativeMissionProgress(progress).user(user)
                        .participantStatus(status).participantRole(ParticipantRole.MEMBER).build()));
        GetLocationMapModalResponse response = (GetLocationMapModalResponse) service.getMapModal(15L, request("LOCATION"));
        assertThat(response.mission().isCompleted()).isEqualTo(completed);
        assertThat(response.mission().rewardDetail()).isEqualTo(new GetLocationMapModalResponse.RewardDetail(null, null, null));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void 같은_유형과_다른_유형의_중복_모두_로그후_중단한다(boolean mixed, CapturedOutput output) {
        foundLocation();
        TreasureMission treasure = treasure();
        if (mixed) {
            Mission other = Mission.builder().id(32L).missionType(mission(MissionTypeCode.COOPERATIVE).getMissionType()).build();
            when(cooperatives.findAllWithRewardsByLocationIdAndStatus(39L, MissionActivationStatus.ACTIVE))
                    .thenReturn(List.of(CooperativeMission.builder().mission(other).location(location).build()));
        } else {
            when(treasures.findAllWithRewardsByLocationIdAndStatus(39L, MissionActivationStatus.ACTIVE))
                    .thenReturn(List.of(treasure, treasure));
        }
        assertThatThrownBy(() -> service.getMapModal(15L, request("LOCATION"))).isInstanceOf(IllegalStateException.class);
        assertThat(output.getAll()).contains("활성 미션 중복", "locationId=39", "31:TREASURE");
        if (mixed) assertThat(output.getAll()).contains("32:COOPERATIVE");
        verifyNoInteractions(images, visits, rewards, books, treasureProgresses, participants);
    }

    @Test
    void DB_오류는_없는_대상으로_숨기지_않는다() {
        when(locations.findById(39L)).thenThrow(new IllegalStateException("테스트 DB 오류"));
        assertThatThrownBy(() -> service.getMapModal(15L, request("LOCATION")))
                .isInstanceOf(IllegalStateException.class).hasMessage("테스트 DB 오류");
    }

    @Test
    void 길바닥은_ACTIVE로_조회하고_장소_부가정보는_조회하지_않는다() {
        RoadGuestbook road = RoadGuestbook.builder().guestbook(guestbook(39L, null, GuestbookStatus.ACTIVE, DATE))
                .locationAlias("바닷가").latitude(33.45).longitude(126.92).build();
        when(roads.findByGuestbookIdAndGuestbookStatus(39L, GuestbookStatus.ACTIVE)).thenReturn(Optional.of(road));
        GetRoadGuestbookMapModalResponse response = (GetRoadGuestbookMapModalResponse)
                service.getMapModal(15L, request("ROAD_GUESTBOOK"));
        assertThat(response.userNickname()).isNull();
        assertThat(response.distanceMeter()).isZero();
        verifyNoInteractions(locations, images, visits, rewards, books, treasures, cooperatives);
    }
}
