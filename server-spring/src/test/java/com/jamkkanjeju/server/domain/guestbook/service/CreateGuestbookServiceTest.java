package com.jamkkanjeju.server.domain.guestbook.service;

import static com.jamkkanjeju.server.domain.guestbook.support.GuestbookFixtures.*;
import static com.jamkkanjeju.server.domain.map.support.MapModalFixtures.user;
import static com.jamkkanjeju.server.domain.map.support.MapLocationDetailFixtures.mission;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.audio.AudioValidator;
import com.jamkkanjeju.server.common.client.BlobStorageClient;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.common.image.ImageValidator;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.entity.*;
import com.jamkkanjeju.server.domain.cooperativemission.repository.*;
import com.jamkkanjeju.server.domain.culturemission.entity.*;
import com.jamkkanjeju.server.domain.culturemission.repository.*;
import com.jamkkanjeju.server.domain.guestbook.dto.*;
import com.jamkkanjeju.server.domain.guestbook.entity.*;
import com.jamkkanjeju.server.domain.guestbook.exception.GuestbookErrorCode;
import com.jamkkanjeju.server.domain.guestbook.repository.*;
import com.jamkkanjeju.server.domain.map.entity.VisitedLocation;
import com.jamkkanjeju.server.domain.map.repository.*;
import com.jamkkanjeju.server.domain.map.support.MapModalFixtures;
import com.jamkkanjeju.server.domain.mission.entity.*;
import com.jamkkanjeju.server.domain.mission.repository.MissionRepository;
import com.jamkkanjeju.server.domain.mission.service.MissionCompletionChecker;
import com.jamkkanjeju.server.domain.treasurehunt.entity.*;
import com.jamkkanjeju.server.domain.treasurehunt.repository.*;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/** 사전 검증·활성/완료 판정과 파일 없는 저장의 분기를 격리한다. */
@ExtendWith(MockitoExtension.class)
class CreateGuestbookServiceTest {
    @Mock UserRepository users;
    @Mock LocationRepository locations;
    @Mock VisitedLocationRepository visits;
    @Mock MissionRepository missions;
    @Mock CultureMissionRepository cultures;
    @Mock TreasureMissionRepository treasures;
    @Mock CooperativeMissionRepository cooperatives;
    @Mock CultureMissionProgressRepository cultureProgresses;
    @Mock TreasureMissionProgressRepository treasureProgresses;
    @Mock CooperativeMissionParticipantRepository participants;
    @Spy MissionCompletionChecker completion = new MissionCompletionChecker();
    @Mock GuestbookRepository books;
    @Mock LocationGuestbookRepository locationBooks;
    @Mock RoadGuestbookRepository roadBooks;
    @Mock ImageValidator imageValidator;
    @Mock AudioValidator audioValidator;
    @Mock BlobStorageClient storage;
    @Spy Clock clock = CLOCK;
    @InjectMocks GuestbookService service;

    @BeforeEach void setup() { when(users.findById(15L)).thenReturn(Optional.of(user(15L, "guestbook@example.com"))); }

    private void visited() {
        when(locations.findById(39L)).thenReturn(Optional.of(MapModalFixtures.location(39L, 900L)));
        when(visits.findByUserIdAndLocationId(15L, 39L)).thenReturn(Optional.of(VisitedLocation.builder()
                .location(MapModalFixtures.location(39L, 900L)).build()));
    }

    private void saving(boolean general) {
        when(books.saveAndFlush(any())).thenAnswer(invocation -> {
            Guestbook book = invocation.getArgument(0); ReflectionTestUtils.setField(book, "id", 101L); return book;
        });
        if (general) when(locationBooks.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        else when(roadBooks.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private void detail(MissionTypeCode type, MissionActivationStatus status) {
        when(missions.findById(31L)).thenReturn(Optional.of(mission(31L, type)));
        switch (type) {
            case CULTURE -> when(cultures.findById(31L)).thenReturn(Optional.of(CultureMission.builder().status(status).build()));
            case TREASURE -> when(treasures.findById(31L)).thenReturn(Optional.of(TreasureMission.builder().status(status).build()));
            case COOPERATIVE -> when(cooperatives.findById(31L)).thenReturn(Optional.of(CooperativeMission.builder().status(status).build()));
        }
    }

    @Test void 사용자없으면_아무조회나_저장도_진행하지않는다() {
        when(users.findById(15L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.createGuestbook(15L, request("GENERAL", null))).extracting("errorCode").isEqualTo(CommonErrorCode.UNAUTHORIZED);
        verifyNoInteractions(locations, visits, missions, books, storage);
    }

    @Test void 장소와_방문을_순서대로_확인하고_실패시_저장하지않는다() {
        assertThatThrownBy(() -> service.createGuestbook(15L, request("GENERAL", null))).extracting("errorCode").isEqualTo(GuestbookErrorCode.LOCATION_NOT_FOUND);
        verifyNoInteractions(visits, books, storage);
        when(locations.findById(39L)).thenReturn(Optional.of(MapModalFixtures.location(39L, 900L)));
        assertThatThrownBy(() -> service.createGuestbook(15L, request("GENERAL", null))).extracting("errorCode").isEqualTo(GuestbookErrorCode.LOCATION_NOT_VISITED);
        verifyNoInteractions(missions, books, storage);
    }

    @Test void 미션미전달은_조회없이_빈콘텐츠를_ACTIVE와_KST로_저장한다() {
        visited(); saving(true);
        CreateGuestbookResponse response = service.createGuestbook(15L, request("GENERAL", null));
        assertThat(response.savedAt()).isEqualTo(NOW); assertThat(response.visitedAt()).isEqualTo(DATE);
        ArgumentCaptor<Guestbook> captor = ArgumentCaptor.forClass(Guestbook.class);
        verify(books).saveAndFlush(captor.capture()); assertThat(captor.getValue().getStatus()).isEqualTo(GuestbookStatus.ACTIVE);
        verifyNoInteractions(missions, cultureProgresses, treasureProgresses, participants, storage);
    }

    @Test void 길바닥은_장소_미션조회없이_저장한다() {
        saving(false);
        CreateGuestbookResponse response = service.createGuestbook(15L, request("ROAD", null));
        assertThat(response.locationAlias()).isEqualTo("바다 앞"); assertThat(response.missionId()).isNull();
        verifyNoInteractions(locations, visits, missions, cultureProgresses, treasureProgresses, participants, locationBooks, storage);
    }

    @ParameterizedTest @EnumSource(MissionTypeCode.class)
    void 비활성미션은_완료이력을_조회하기전에_거절한다(MissionTypeCode type) {
        visited(); detail(type, MissionActivationStatus.INACTIVE);
        assertThatThrownBy(() -> service.createGuestbook(15L, request("GENERAL", 31L))).extracting("errorCode").isEqualTo(GuestbookErrorCode.MISSION_INACTIVE);
        verifyNoInteractions(cultureProgresses, treasureProgresses, participants, books, storage);
    }

    @ParameterizedTest @EnumSource(MissionTypeCode.class)
    void 상세미션이_없으면_미션없음이다(MissionTypeCode type) {
        visited(); when(missions.findById(31L)).thenReturn(Optional.of(mission(31L, type)));
        assertThatThrownBy(() -> service.createGuestbook(15L, request("GENERAL", 31L))).extracting("errorCode").isEqualTo(GuestbookErrorCode.MISSION_NOT_FOUND);
        verifyNoInteractions(cultureProgresses, treasureProgresses, participants, books, storage);
    }

    @Test void 공통미션이_없으면_상세를_읽지않는다() {
        visited();
        assertThatThrownBy(() -> service.createGuestbook(15L, request("GENERAL", 31L))).extracting("errorCode").isEqualTo(GuestbookErrorCode.MISSION_NOT_FOUND);
        verifyNoInteractions(cultures, treasures, cooperatives, books);
    }

    @ParameterizedTest @EnumSource(MissionTypeCode.class)
    void 활성_미완료나_이력없음은_연결없이_작성한다(MissionTypeCode type) {
        visited(); detail(type, MissionActivationStatus.ACTIVE); saving(true);
        assertThat(service.createGuestbook(15L, request("GENERAL", 31L)).missionId()).isNull();
        switch (type) {
            case CULTURE -> when(cultureProgresses.findByUserIdAndCultureMissionMissionId(15L, 31L)).thenReturn(Optional.of(
                    CultureMissionProgress.builder().missionStatus(MissionProgressStatus.IN_PROGRESS).build()));
            case TREASURE -> when(treasureProgresses.findByUserIdAndTreasureMissionMissionId(15L, 31L)).thenReturn(Optional.of(
                    TreasureMissionProgress.builder().missionStatus(MissionProgressStatus.IN_PROGRESS).build()));
            case COOPERATIVE -> when(participants.findAllByUserIdAndMissionId(15L, 31L)).thenReturn(List.of(
                    participant(ParticipantStatus.ACCEPTED, MissionProgressStatus.IN_PROGRESS)));
        }
        assertThat(service.createGuestbook(15L, request("GENERAL", 31L)).missionId()).isNull();
    }

    @ParameterizedTest @EnumSource(MissionTypeCode.class)
    void 세유형_완료이력은_미션을_연결한다(MissionTypeCode type) {
        visited(); detail(type, MissionActivationStatus.ACTIVE); saving(true);
        switch (type) {
            case CULTURE -> when(cultureProgresses.findByUserIdAndCultureMissionMissionId(15L, 31L)).thenReturn(Optional.of(
                    CultureMissionProgress.builder().missionStatus(MissionProgressStatus.COMPLETED).build()));
            case TREASURE -> when(treasureProgresses.findByUserIdAndTreasureMissionMissionId(15L, 31L)).thenReturn(Optional.of(
                    TreasureMissionProgress.builder().missionStatus(MissionProgressStatus.COMPLETED).build()));
            case COOPERATIVE -> when(participants.findAllByUserIdAndMissionId(15L, 31L)).thenReturn(List.of(
                    participant(ParticipantStatus.ACCEPTED, MissionProgressStatus.IN_PROGRESS),
                    participant(ParticipantStatus.ACCEPTED, MissionProgressStatus.COMPLETED)));
        }
        assertThat(service.createGuestbook(15L, request("GENERAL", 31L)).missionId()).isEqualTo(31L);
    }

    @ParameterizedTest @ValueSource(booleans = {false, true})
    void 협동_PENDING완료나_ACCEPTED진행중은_미완료다(boolean pending) {
        visited(); detail(MissionTypeCode.COOPERATIVE, MissionActivationStatus.ACTIVE); saving(true);
        when(participants.findAllByUserIdAndMissionId(15L, 31L)).thenReturn(List.of(participant(
                pending ? ParticipantStatus.PENDING : ParticipantStatus.ACCEPTED,
                pending ? MissionProgressStatus.COMPLETED : MissionProgressStatus.IN_PROGRESS)));
        assertThat(service.createGuestbook(15L, request("GENERAL", 31L)).missionId()).isNull();
    }

    private CooperativeMissionParticipant participant(ParticipantStatus status, MissionProgressStatus progressStatus) {
        return CooperativeMissionParticipant.builder().participantStatus(status).cooperativeMissionProgress(
                CooperativeMissionProgress.builder().missionStatus(progressStatus).build()).build();
    }
}
