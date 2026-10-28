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
import com.jamkkanjeju.server.domain.guestbook.dto.GetGuestbooksRequest;
import com.jamkkanjeju.server.domain.guestbook.dto.GetGuestbooksResponse;
import com.jamkkanjeju.server.domain.guestbook.dto.GetGuestbooksResponse.GeneralGuestbookInfo;
import com.jamkkanjeju.server.domain.guestbook.dto.GetGuestbooksResponse.GuestbooksPage;
import com.jamkkanjeju.server.domain.guestbook.dto.GetGuestbooksResponse.RoadGuestbookInfo;
import com.jamkkanjeju.server.domain.guestbook.dto.GetGuestbooksResponse.VisitedLocationInfo;
import com.jamkkanjeju.server.domain.guestbook.dto.ToggleGuestbookLikeResponse;
import com.jamkkanjeju.server.domain.guestbook.entity.Guestbook;
import com.jamkkanjeju.server.domain.guestbook.entity.GuestbookLike;
import com.jamkkanjeju.server.domain.guestbook.entity.GuestbookLikeId;
import com.jamkkanjeju.server.domain.guestbook.entity.GuestbookStatus;
import com.jamkkanjeju.server.domain.guestbook.entity.LocationGuestbook;
import com.jamkkanjeju.server.domain.guestbook.entity.RoadGuestbook;
import com.jamkkanjeju.server.domain.guestbook.exception.GuestbookErrorCode;
import com.jamkkanjeju.server.domain.guestbook.repository.GuestbookRepository;
import com.jamkkanjeju.server.domain.guestbook.repository.GuestbookLikeRepository;
import com.jamkkanjeju.server.domain.guestbook.repository.GuestbookLikeRepository.LikeCount;
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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** 일반·길바닥 방명록을 조회하고 방문·미션 조건을 검증하여 선택 첨부 파일과 함께 저장한다. */
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
    private final GuestbookLikeRepository guestbookLikeRepository;
    private final ImageValidator imageValidator;
    private final AudioValidator audioValidator;
    private final BlobStorageClient blobStorageClient;
    private final Clock clock;

    /** 같은 방명록의 토글을 순서대로 처리하고 변경 후 좋아요 상태와 전체 개수를 반환한다. */
    // 잠금 대기 전 사용자 조회가 만든 스냅샷 대신 각 조회에서 최신 커밋 상태를 읽는다.
    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ToggleGuestbookLikeResponse toggleGuestbookLike(Long userId, Long guestbookId) {
        // 1. 현재 사용자 확인
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2~3. 방명록 쓰기 잠금으로 동시 토글을 순서대로 처리하고 존재·활성 여부 확인
        Guestbook guestbook = guestbookRepository.findByIdForUpdate(guestbookId)
                .orElseThrow(() -> new BusinessException(GuestbookErrorCode.GUESTBOOK_NOT_FOUND));
        if (guestbook.getStatus() == GuestbookStatus.INACTIVE) {
            throw new BusinessException(GuestbookErrorCode.GUESTBOOK_INACTIVE);
        }

        // 4. 잠금 획득 이후 현재 사용자와 방명록 조합의 최신 좋아요 확인
        Optional<GuestbookLike> like = guestbookLikeRepository.findById(new GuestbookLikeId(guestbookId, userId));

        // 5. 이미 눌렀으면 실제 삭제하고 없으면 새 좋아요 생성 (본인 작성 여부는 제한하지 않는다)
        boolean isLiked = like.isEmpty();
        if (like.isPresent()) {
            guestbookLikeRepository.delete(like.get());
        } else {
            guestbookLikeRepository.save(GuestbookLike.builder().guestbook(guestbook).user(user).build());
        }

        // 6~7. 변경을 반영한 전체 개수와 현재 사용자의 처리 결과 반환
        guestbookLikeRepository.flush();
        long likeCount = guestbookLikeRepository.countByGuestbookId(guestbookId);
        return ToggleGuestbookLikeResponse.of(guestbookId, isLiked, likeCount);
    }

    /** 활성 방명록을 유형별로 조회하고 현재 사용자의 마지막 확인 시각을 갱신한다. */
    @Transactional
    public GetGuestbooksResponse getGuestbooks(Long userId, GetGuestbooksRequest request) {
        // 1. 현재 사용자 확인 (유형별 페이지 조건은 요청 DTO에서 검증한다)
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2. 현재 사용자의 방문 장소 전체를 최근 방문 순서로 조회
        List<VisitedLocationInfo> visitedLocations = visitedLocationRepository.findAllByUserId(userId).stream()
                .map(visited -> VisitedLocationInfo.from(visited.getLocation())).toList();

        // 3. 장소 연결이 유지된 활성 일반 방명록 페이지 조회
        Slice<LocationGuestbook> generalPage = locationGuestbookRepository.findSliceByStatus(
                GuestbookStatus.ACTIVE, PageRequest.of(request.generalPage(), request.generalSize()));

        // 4. 활성 길바닥 방명록 페이지를 별도 조건으로 조회
        Slice<RoadGuestbook> roadPage = roadGuestbookRepository.findSliceByStatus(
                GuestbookStatus.ACTIVE, PageRequest.of(request.roadPage(), request.roadSize()));

        // 5. 실제 반환할 두 페이지의 ID만 모아 좋아요 여부·전체 개수를 일괄 조회
        List<Long> guestbookIds = Stream.concat(
                generalPage.getContent().stream().map(LocationGuestbook::getGuestbookId),
                roadPage.getContent().stream().map(RoadGuestbook::getGuestbookId)).toList();
        Set<Long> likedIds = guestbookIds.isEmpty() ? Set.of()
                : Set.copyOf(guestbookLikeRepository.findGuestbookIdsByUserIdAndGuestbookIds(userId, guestbookIds));
        Map<Long, Long> likeCounts = guestbookIds.isEmpty() ? Map.of()
                : guestbookLikeRepository.countByGuestbookIds(guestbookIds).stream()
                        .collect(Collectors.toMap(LikeCount::getGuestbookId, LikeCount::getLikeCount));

        // 6. 조회 순서를 유지한 방문 장소·방명록 목록과 유형별 페이지 정보 반환
        List<GeneralGuestbookInfo> generalGuestbooks = generalPage.getContent().stream()
                .map(guestbook -> GeneralGuestbookInfo.of(guestbook, likedIds.contains(guestbook.getGuestbookId()),
                        likeCounts.getOrDefault(guestbook.getGuestbookId(), 0L))).toList();
        List<RoadGuestbookInfo> roadGuestbooks = roadPage.getContent().stream()
                .map(guestbook -> RoadGuestbookInfo.of(guestbook, likedIds.contains(guestbook.getGuestbookId()),
                        likeCounts.getOrDefault(guestbook.getGuestbookId(), 0L))).toList();
        // 7. 빈 목록과 페이지 조회를 포함한 정상 조회마다 현재 사용자의 확인 시각 갱신
        user.checkGuestbooks(LocalDateTime.ofInstant(clock.instant(), ZoneId.of("Asia/Seoul")));
        return GetGuestbooksResponse.of(visitedLocations, generalGuestbooks, roadGuestbooks,
                GuestbooksPage.of(request.generalPage(), request.generalSize(), generalPage.hasNext()),
                GuestbooksPage.of(request.roadPage(), request.roadSize(), roadPage.hasNext()));
    }

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
