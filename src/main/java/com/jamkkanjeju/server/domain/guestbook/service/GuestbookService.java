package com.jamkkanjeju.server.domain.guestbook.service;

import com.jamkkanjeju.server.common.audio.AudioValidator;
import com.jamkkanjeju.server.common.audio.AudioValidator.ValidatedAudio;
import com.jamkkanjeju.server.common.client.BlobRollbackCleanup;
import com.jamkkanjeju.server.common.client.BlobStorageClient;
import com.jamkkanjeju.server.common.client.BlobStorageClient.UploadedBlob;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.common.image.ImageValidator;
import com.jamkkanjeju.server.common.image.ImageValidator.ValidatedImage;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionProgressRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionRepository;
import com.jamkkanjeju.server.domain.guestbook.dto.CreateGuestbookRequest;
import com.jamkkanjeju.server.domain.guestbook.dto.CreateGuestbookResponse;
import com.jamkkanjeju.server.domain.guestbook.entity.Guestbook;
import com.jamkkanjeju.server.domain.guestbook.entity.GuestbookStatus;
import com.jamkkanjeju.server.domain.guestbook.entity.LocationGuestbook;
import com.jamkkanjeju.server.domain.guestbook.entity.RoadGuestbook;
import com.jamkkanjeju.server.domain.guestbook.exception.GuestbookErrorCode;
import com.jamkkanjeju.server.domain.guestbook.repository.GuestbookRepository;
import com.jamkkanjeju.server.domain.guestbook.repository.LocationGuestbookRepository;
import com.jamkkanjeju.server.domain.guestbook.repository.RoadGuestbookRepository;
import com.jamkkanjeju.server.domain.map.entity.VisitedLocation;
import com.jamkkanjeju.server.domain.map.repository.LocationRepository;
import com.jamkkanjeju.server.domain.map.repository.VisitedLocationRepository;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.mission.repository.MissionRepository;
import com.jamkkanjeju.server.domain.mission.service.MissionCompletionChecker;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionProgressRepository;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 방문·미션 조건을 검증하고 일반·길바닥 방명록과 선택 첨부 파일을 함께 저장한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GuestbookService {
    private final UserRepository userRepository;
    private final LocationRepository locationRepository;
    private final VisitedLocationRepository visitedLocationRepository;
    private final MissionRepository missionRepository;
    private final CultureMissionRepository cultureMissionRepository;
    private final TreasureMissionRepository treasureMissionRepository;
    private final CooperativeMissionRepository cooperativeMissionRepository;
    private final CultureMissionProgressRepository cultureMissionProgressRepository;
    private final TreasureMissionProgressRepository treasureMissionProgressRepository;
    private final CooperativeMissionParticipantRepository cooperativeMissionParticipantRepository;
    private final MissionCompletionChecker missionCompletionChecker;
    private final GuestbookRepository guestbookRepository;
    private final LocationGuestbookRepository locationGuestbookRepository;
    private final RoadGuestbookRepository roadGuestbookRepository;
    private final ImageValidator imageValidator;
    private final AudioValidator audioValidator;
    private final BlobStorageClient blobStorageClient;
    private final Clock clock;

    /** 일반 방명록의 방문·미션 또는 길바닥 좌표를 확인하고 새 방명록을 생성한다. */
    @Transactional
    public CreateGuestbookResponse createGuestbook(Long userId, CreateGuestbookRequest request) {
        // 1. 현재 사용자 확인 (유형별 조건과 파일 개수·빈 파일은 요청 검증에서 처리한다)
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));
        boolean general = "GENERAL".equals(request.guestbookType());

        // 2. 일반 방명록의 장소 존재와 본인의 방문 기록 확인
        VisitedLocation visitedLocation = null;
        if (general) {
            locationRepository.findById(request.locationId())
                    .orElseThrow(() -> new BusinessException(GuestbookErrorCode.LOCATION_NOT_FOUND));
            visitedLocation = visitedLocationRepository.findByUserIdAndLocationId(userId, request.locationId())
                    .orElseThrow(() -> new BusinessException(GuestbookErrorCode.LOCATION_NOT_VISITED));
        }

        // 3. 미션이 전달되었으면 존재·활성을 먼저 검증하고 본인이 완료한 경우에만 연결
        Mission mission = general && request.missionId() != null ? resolveMission(userId, request.missionId()) : null;

        // 4. 공통 기록과 PK를 공유하는 유형별 기록 생성 및 Blob 경로에 사용할 ID 확보
        Guestbook guestbook = guestbookRepository.saveAndFlush(Guestbook.builder()
                .user(user).visitedAt(request.visitedAt()).contentWriting(request.contentWriting())
                .contentWeather(request.contentWeather()).contentTemperatureCelsius(request.contentTemperatureCelsius())
                .contentColorCode(request.contentColorCode()).savedAt(LocalDateTime.ofInstant(clock.instant(), ZoneId.of("Asia/Seoul")))
                .status(GuestbookStatus.ACTIVE).build());
        LocationGuestbook locationGuestbook = null;
        RoadGuestbook roadGuestbook = null;
        if (general) {
            locationGuestbook = locationGuestbookRepository.save(LocationGuestbook.builder()
                    .guestbook(guestbook).visitedLocation(visitedLocation).mission(mission).build());
        } else {
            roadGuestbook = roadGuestbookRepository.save(RoadGuestbook.builder().guestbook(guestbook)
                    .locationAlias(request.locationAlias()).latitude(request.latitude()).longitude(request.longitude()).build());
        }

        // 5. 선택 파일 검증·원본 업로드 및 커밋 실패까지 포함한 롤백 삭제 등록
        String prefix = "guestbook/" + (general ? "general/" : "road/") + guestbook.getId();
        String imageUrl = null;
        String audioUrl = null;
        if (request.imageFile() != null) {
            ValidatedImage image = imageValidator.validate(request.imageFile(), GuestbookErrorCode.INVALID_IMAGE_FORMAT,
                    GuestbookErrorCode.IMAGE_SIZE_EXCEEDED, GuestbookErrorCode.INVALID_IMAGE);
            imageUrl = uploadAttachment(guestbook.getId(), image.data(),
                    prefix + "/images/" + UUID.randomUUID() + image.format().extension(), image.format().contentType());
        }
        if (request.audioFile() != null) {
            ValidatedAudio audio = audioValidator.validate(request.audioFile(), GuestbookErrorCode.INVALID_AUDIO_FORMAT,
                    GuestbookErrorCode.AUDIO_SIZE_EXCEEDED, GuestbookErrorCode.INVALID_AUDIO,
                    GuestbookErrorCode.AUDIO_DURATION_EXCEEDED);
            audioUrl = uploadAttachment(guestbook.getId(), audio.data(),
                    prefix + "/audios/" + UUID.randomUUID() + audio.format().extension(), audio.format().contentType());
        }

        // 6. 단일 URL과 사용자가 입력한 제목 반영 (오디오가 없으면 제목도 null)
        guestbook.attachMedia(imageUrl, audioUrl, request.audioTitle());
        guestbookRepository.flush();

        // 7. 실제 저장값으로 응답 구성. 최종 커밋과 롤백은 트랜잭션 경계에서 처리한다.
        return general ? CreateGuestbookResponse.from(locationGuestbook) : CreateGuestbookResponse.from(roadGuestbook);
    }

    /** 미션 활성 상태를 완료 이력보다 먼저 확인하고, 미완료이면 연결 없이 작성하도록 null을 반환한다. */
    private Mission resolveMission(Long userId, Long missionId) {
        Mission mission = missionRepository.findById(missionId)
                .orElseThrow(() -> new BusinessException(GuestbookErrorCode.MISSION_NOT_FOUND));
        MissionActivationStatus status = switch (mission.getMissionType().getType()) {
            case CULTURE -> cultureMissionRepository.findById(missionId).map(CultureMission::getStatus)
                    .orElseThrow(() -> new BusinessException(GuestbookErrorCode.MISSION_NOT_FOUND));
            case TREASURE -> treasureMissionRepository.findById(missionId).map(TreasureMission::getStatus)
                    .orElseThrow(() -> new BusinessException(GuestbookErrorCode.MISSION_NOT_FOUND));
            case COOPERATIVE -> cooperativeMissionRepository.findById(missionId).map(CooperativeMission::getStatus)
                    .orElseThrow(() -> new BusinessException(GuestbookErrorCode.MISSION_NOT_FOUND));
        };
        if (status == MissionActivationStatus.INACTIVE) {
            throw new BusinessException(GuestbookErrorCode.MISSION_INACTIVE);
        }
        boolean completed = switch (mission.getMissionType().getType()) {
            case CULTURE -> cultureMissionProgressRepository.findByUserIdAndCultureMissionMissionId(userId, missionId)
                    .map(progress -> progress.getMissionStatus() == MissionProgressStatus.COMPLETED).orElse(false);
            case TREASURE -> treasureMissionProgressRepository.findByUserIdAndTreasureMissionMissionId(userId, missionId)
                    .map(missionCompletionChecker::isCompleted).orElse(false);
            case COOPERATIVE -> cooperativeMissionParticipantRepository.findAllByUserIdAndMissionId(userId, missionId)
                    .stream().anyMatch(missionCompletionChecker::isCompleted);
        };
        return completed ? mission : null;
    }

    /** 업로드 직후 삭제 대상을 등록하여 뒤쪽 파일 또는 DB 커밋 실패 시 이번 파일만 정리한다. */
    private String uploadAttachment(Long guestbookId, byte[] data, String blobName, String contentType) {
        BlobRollbackCleanup.requireActiveTransaction();
        UploadedBlob uploaded = blobStorageClient.upload(data, blobName, contentType);
        BlobRollbackCleanup.register(blobStorageClient, uploaded, "방명록 guestbookId=" + guestbookId);
        return uploaded.url();
    }
}
