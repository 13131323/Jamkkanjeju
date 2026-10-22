package com.jamkkanjeju.server.domain.cooperativemission.service;

import com.jamkkanjeju.server.common.client.BlobRollbackCleanup;
import com.jamkkanjeju.server.common.client.BlobStorageClient;
import com.jamkkanjeju.server.common.client.BlobStorageClient.UploadedBlob;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.common.image.ImageValidator;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.dto.DecideCooperativeMissionParticipantRequest.Decision;
import com.jamkkanjeju.server.domain.cooperativemission.dto.JoinCooperativeMissionResponse;
import com.jamkkanjeju.server.domain.cooperativemission.dto.SaveCooperativeMissionProgressRequest;
import com.jamkkanjeju.server.domain.cooperativemission.dto.SaveCooperativeMissionRoleAssignmentRequest;
import com.jamkkanjeju.server.domain.cooperativemission.dto.SaveCooperativeMissionRoleProgressRequest;
import com.jamkkanjeju.server.domain.cooperativemission.dto.SaveCooperativeMissionRoleProgressResponse;
import com.jamkkanjeju.server.domain.cooperativemission.dto.StartCooperativeMissionResponse;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionProgress;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionRoleProgress;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantRole;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantStatus;
import com.jamkkanjeju.server.domain.cooperativemission.exception.CooperativeMissionErrorCode;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionProgressRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRoleProgressRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeRoleCardRepository;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatusId;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.mission.service.MissionRewardGranter;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 협동 미션 팀의 시작·이어하기, 참가 요청, 역할 배정·사진 인증과 단계 변경·완료 보상·중단을 처리한다. */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CooperativeMissionService {

    private static final int TEAM_TOKEN_BYTE_LENGTH = 32;
    private static final long MAX_PARTICIPANT_COUNT = 6L;
    private static final int COMPLETION_REWARD_LIMIT = 3;
    private static final int PERFORMANCE_STEP = 2;

    private final UserRepository userRepository;
    private final CooperativeMissionRepository cooperativeMissionRepository;
    private final CooperativeMissionProgressRepository cooperativeMissionProgressRepository;
    private final CooperativeMissionParticipantRepository cooperativeMissionParticipantRepository;
    private final CooperativeMissionRoleProgressRepository cooperativeMissionRoleProgressRepository;
    private final CooperativeRoleCardRepository cooperativeRoleCardRepository;
    private final MissionRewardStatusRepository missionRewardStatusRepository;
    private final MissionRewardGranter missionRewardGranter;
    private final ImageValidator imageValidator;
    private final BlobStorageClient blobStorageClient;
    private final CooperativeMissionPhotoVerifier cooperativeMissionPhotoVerifier;
    private final Clock clock;
    private final SecureRandom secureRandom = new SecureRandom();

    /** 해당 미션에서 본인이 참가·대기 중인 팀을 이어가고, 없으면 새 팀과 방장 참가자를 함께 생성한다. */
    @Transactional
    public StartCooperativeMissionResponse startCooperativeMission(Long userId, Long missionId) {
        // 1. 현재 사용자 확인 및 잠금 (이어하기 조회부터 생성까지 동시 중복 생성을 막는다)
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2. 협동 미션 확인 (확인 전에는 진행도·참가자·팀 토큰을 만들지 않는다)
        CooperativeMission cooperativeMission = cooperativeMissionRepository.findById(missionId)
                .orElseThrow(() -> new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_NOT_FOUND));
        if (cooperativeMission.getStatus() == MissionActivationStatus.INACTIVE) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_INACTIVE);
        }

        // 3. 본인이 참가·대기 중인 팀 조회 (역할과 무관하며 PENDING을 자동 수락하지 않는다)
        var savedParticipant = cooperativeMissionParticipantRepository
                .findAllByUserIdAndMissionId(userId, missionId).stream()
                .filter(participant -> participant.getCooperativeMissionProgress().getMissionStatus()
                        == MissionProgressStatus.IN_PROGRESS)
                .findFirst();

        // 4. 해당 미션에서 이어갈 팀이 없으면 신규 시작 + 5. 진행도와 본인 참가자 생성
        boolean created = savedParticipant.isEmpty();
        CooperativeMissionParticipant participant = savedParticipant
                .orElseGet(() -> start(user, cooperativeMission));

        // 6. 진행도 ID와 수락된 방장에게만 공개할 팀 토큰으로 응답 구성
        CooperativeMissionProgress progress = participant.getCooperativeMissionProgress();
        String teamToken = participant.getParticipantRole() == ParticipantRole.HOST
                && participant.getParticipantStatus() == ParticipantStatus.ACCEPTED
                ? progress.getTeamToken()
                : null;
        return StartCooperativeMissionResponse.of(progress, teamToken, created);
    }

    /** 팀 토큰에 해당하는 진행 중인 팀에 기존 참가 정보를 반환하거나 수락 대기 팀원을 새로 등록한다. */
    @Transactional
    public JoinCooperativeMissionResponse joinCooperativeMission(Long userId, String teamToken) {
        // 1. 사용자 잠금 (시작/이어하기와 참여 요청 사이의 동일 사용자·미션 중복 참가를 막는다)
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2. 팀 진행도 잠금 및 미션 확인 (같은 팀의 동시 요청이 최대 인원을 초과하지 않게 한다)
        CooperativeMissionProgress progress = cooperativeMissionProgressRepository.findByTeamTokenForUpdate(teamToken)
                .filter(savedProgress -> savedProgress.getMissionStatus() == MissionProgressStatus.IN_PROGRESS)
                .orElseThrow(() -> new BusinessException(CooperativeMissionErrorCode.INVALID_INVITE_TOKEN));
        CooperativeMission cooperativeMission = progress.getCooperativeMission();
        if (cooperativeMission.getStatus() == MissionActivationStatus.INACTIVE) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_INACTIVE);
        }

        // 3. 대상 팀에 이미 등록된 사용자는 상태를 바꾸거나 중복 생성하지 않고 그대로 반환한다
        var savedParticipant = cooperativeMissionParticipantRepository
                .findByCooperativeMissionProgressIdAndUserId(progress.getId(), userId);
        if (savedParticipant.isPresent()) {
            return JoinCooperativeMissionResponse.of(progress, savedParticipant.get(), false);
        }

        // 4. 같은 미션의 다른 진행 중인 팀에 참가·대기 중이면 새 팀에 중복 참가하지 못한다
        boolean participatingInAnotherTeam = cooperativeMissionParticipantRepository
                .findAllByUserIdAndMissionId(userId, cooperativeMission.getMissionId()).stream()
                .map(CooperativeMissionParticipant::getCooperativeMissionProgress)
                .anyMatch(savedProgress -> !savedProgress.getId().equals(progress.getId())
                        && savedProgress.getMissionStatus() == MissionProgressStatus.IN_PROGRESS);
        if (participatingInAnotherTeam) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_ALREADY_PARTICIPATING);
        }

        // 5. 새 참여 요청은 첫 단계이며 방장을 포함한 현재 참가자가 6명 미만일 때만 허용한다
        if (progress.getCurrentStep() != CooperativeMissionProgress.FIRST_STEP) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_JOIN_CLOSED);
        }
        if (cooperativeMissionParticipantRepository.countByCooperativeMissionProgressId(progress.getId())
                >= MAX_PARTICIPANT_COUNT) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_FULL);
        }

        // 6. 수락 전 팀원으로 등록하고 joinedAt은 null로 유지한다
        CooperativeMissionParticipant participant = cooperativeMissionParticipantRepository.save(
                CooperativeMissionParticipant.builder()
                        .cooperativeMissionProgress(progress)
                        .user(user)
                        .participantStatus(ParticipantStatus.PENDING)
                        .participantRole(ParticipantRole.MEMBER)
                        .build());

        // 7. 프론트의 상태 폴링에 필요한 팀 진행도와 참가자 정보를 반환한다
        return JoinCooperativeMissionResponse.of(progress, participant, true);
    }

    /** 수락된 방장이 초대 단계의 팀원 참여 요청을 수락하거나 거절한다. */
    @Transactional
    public void decideCooperativeMissionParticipant(Long userId, Long progressId, Long participantId,
                                                     Decision decision) {
        // 1. 요청 및 현재 사용자 정보는 컨트롤러에서 전달받는다
        // 2. 팀 진행도 잠금 및 미션 확인 (같은 팀의 참가자 변경을 순서대로 처리한다)
        CooperativeMissionProgress progress = cooperativeMissionProgressRepository.findByIdForUpdate(progressId)
                .filter(savedProgress -> savedProgress.getMissionStatus() == MissionProgressStatus.IN_PROGRESS)
                .orElseThrow(() -> new BusinessException(
                        CooperativeMissionErrorCode.COOPERATIVE_MISSION_PROGRESS_NOT_FOUND));
        if (progress.getCooperativeMission().getStatus() == MissionActivationStatus.INACTIVE) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_INACTIVE);
        }

        // 3. 대상 팀의 수락된 방장만 참여 요청을 처리할 수 있다
        cooperativeMissionParticipantRepository.findByCooperativeMissionProgressIdAndUserId(progressId, userId)
                .filter(participant -> participant.getParticipantRole() == ParticipantRole.HOST
                        && participant.getParticipantStatus() == ParticipantStatus.ACCEPTED)
                .orElseThrow(() -> new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_HOST_ONLY));

        // 4. 초대 단계를 지난 팀에서는 수락과 거절 모두 허용하지 않는다
        if (progress.getCurrentStep() != CooperativeMissionProgress.FIRST_STEP) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_JOIN_CLOSED);
        }

        // 5. 요청한 진행도에 속한 팀원만 대상으로 삼는다
        CooperativeMissionParticipant participant = cooperativeMissionParticipantRepository
                .findByIdAndCooperativeMissionProgressId(participantId, progressId)
                .filter(savedParticipant -> savedParticipant.getParticipantRole() == ParticipantRole.MEMBER)
                .orElseThrow(() -> new BusinessException(
                        CooperativeMissionErrorCode.COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND));

        switch (decision) {
            case ACCEPT -> {
                // 6. 이미 수락된 참가자는 합류 시각을 유지하여 재요청을 멱등 처리한다
                if (participant.getParticipantStatus() == ParticipantStatus.PENDING) {
                    participant.accept(LocalDateTime.now(clock));
                }
            }
            case REJECT -> {
                // 7. 수락 대기 참가자만 삭제하고, 이미 수락된 팀원은 보호한다
                if (participant.getParticipantStatus() == ParticipantStatus.ACCEPTED) {
                    throw new BusinessException(
                            CooperativeMissionErrorCode.COOPERATIVE_MISSION_PARTICIPANT_ALREADY_ACCEPTED);
                }
                cooperativeMissionParticipantRepository.delete(participant);
            }
        }
    }

    /** 수락된 방장이 팀을 다음 단계로 변경하고, 완료 시 참가자별 최초 완료 보상을 함께 지급한다. */
    @Transactional
    public void saveCooperativeMissionProgress(Long userId, Long progressId,
                                               SaveCooperativeMissionProgressRequest request) {
        // 1. 현재 사용자 확인
        userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2. 팀 진행도 잠금 및 미션 확인 (완료된 팀도 조회한 뒤 단계 변경 오류로 처리한다)
        CooperativeMissionProgress progress = cooperativeMissionProgressRepository.findByIdForUpdate(progressId)
                .orElseThrow(() -> new BusinessException(
                        CooperativeMissionErrorCode.COOPERATIVE_MISSION_PROGRESS_NOT_FOUND));
        CooperativeMission mission = progress.getCooperativeMission();
        if (mission.getStatus() == MissionActivationStatus.INACTIVE) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_INACTIVE);
        }

        // 3. 대상 팀의 수락된 방장만 단계를 변경할 수 있다
        cooperativeMissionParticipantRepository.findByCooperativeMissionProgressIdAndUserId(progressId, userId)
                .filter(participant -> participant.getParticipantRole() == ParticipantRole.HOST
                        && participant.getParticipantStatus() == ParticipantStatus.ACCEPTED)
                .orElseThrow(() -> new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_HOST_ONLY));

        // 4. 이미 완료되었거나 순차적인 다음 단계가 아니면 같은 오류로 처리한다
        int nextStep = request.currentStep();
        if (progress.getMissionStatus() == MissionProgressStatus.COMPLETED
                || progress.getCurrentStep() >= CooperativeMissionProgress.LAST_STEP
                || nextStep != progress.getCurrentStep() + 1
                || nextStep <= CooperativeMissionProgress.FIRST_STEP) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_STEP_NOT_ALLOWED);
        }

        var participants = cooperativeMissionParticipantRepository.findAllByCooperativeMissionProgressId(progressId);
        if (progress.getCurrentStep() == CooperativeMissionProgress.FIRST_STEP) {
            // 5. 초대·역할 배정을 모두 마친 팀만 수행 단계로 이동한다
            if (participants.stream().anyMatch(participant ->
                    participant.getParticipantStatus() == ParticipantStatus.PENDING)) {
                throw new BusinessException(
                        CooperativeMissionErrorCode.COOPERATIVE_MISSION_PENDING_PARTICIPANT_EXISTS);
            }
            var assignedParticipantIds = cooperativeMissionRoleProgressRepository
                    .findAllByParticipantCooperativeMissionProgressIdOrderByParticipantIdAscRoleCardIdAsc(progressId)
                    .stream()
                    .map(role -> role.getParticipant().getId())
                    .collect(Collectors.toSet());
            boolean unassignedParticipantExists = participants.stream()
                    .filter(participant -> participant.getParticipantStatus() == ParticipantStatus.ACCEPTED)
                    .anyMatch(participant -> !assignedParticipantIds.contains(participant.getId()));
            if (unassignedParticipantExists) {
                throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_PARTICIPANT_ROLE_REQUIRED);
            }

            // 7. 수행 단계 진입은 단계만 바꾸고 보상·완료 정보는 유지한다
            progress.moveToNextStep();
            return;
        }

        // 6. 미인증 역할이 남아 있는 종료는 별도 중단 API의 책임이다
        boolean unfinishedRoleExists = cooperativeMissionRoleProgressRepository
                .findAllByParticipantCooperativeMissionProgressIdOrderByParticipantIdAscRoleCardIdAsc(progressId)
                .stream()
                .anyMatch(role -> role.getProgressStatus() != MissionProgressStatus.COMPLETED);
        if (unfinishedRoleExists) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_STEP_NOT_ALLOWED);
        }

        // 8. 현재 팀을 완료하기 전에 사용자별 과거 완료·지급 이력을 확인해 최초 보상만 지급한다
        participants.stream()
                .filter(participant -> participant.getParticipantStatus() == ParticipantStatus.ACCEPTED)
                .forEach(participant -> grantFirstCompletionReward(participant.getUser(), mission, progressId));
        progress.moveToNextStep();
        progress.complete(LocalDateTime.now(clock));
        // 9. 단계·완료 시각·전체 참가자 보상은 같은 트랜잭션에서 커밋하며 실패 시 함께 롤백된다
    }

    /** 수락된 방장이 첫 단계에서 역할 카드의 담당자를 배정·변경하고 동일 배정은 그대로 유지한다. */
    @Transactional
    public void saveCooperativeMissionRoleAssignment(Long userId, Long progressId, Long roleCardId,
                                                     SaveCooperativeMissionRoleAssignmentRequest request) {
        // 1. 현재 사용자 확인
        userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2. 팀 잠금 및 미션 확인 (배정 변경과 수행 단계 전환을 같은 팀 기준으로 순서대로 처리한다)
        CooperativeMissionProgress progress = cooperativeMissionProgressRepository.findByIdForUpdate(progressId)
                .orElseThrow(() -> new BusinessException(
                        CooperativeMissionErrorCode.COOPERATIVE_MISSION_PROGRESS_NOT_FOUND));
        if (progress.getCooperativeMission().getStatus() == MissionActivationStatus.INACTIVE) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_INACTIVE);
        }

        // 3. 대상 팀의 수락된 방장만 배정을 저장할 수 있다
        cooperativeMissionParticipantRepository.findByCooperativeMissionProgressIdAndUserId(progressId, userId)
                .filter(participant -> participant.getParticipantRole() == ParticipantRole.HOST
                        && participant.getParticipantStatus() == ParticipantStatus.ACCEPTED)
                .orElseThrow(() -> new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_HOST_ONLY));

        // 4. 동일 배정 재요청도 진행 중인 첫 단계에서만 허용한다
        if (progress.getMissionStatus() != MissionProgressStatus.IN_PROGRESS
                || progress.getCurrentStep() != CooperativeMissionProgress.FIRST_STEP) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_STEP_NOT_ALLOWED);
        }

        // 5. 역할 카드는 모든 협동 미션이 공통으로 사용하는 마스터 데이터다
        var roleCard = cooperativeRoleCardRepository.findById(roleCardId)
                .orElseThrow(() -> new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_ROLE_CARD_NOT_FOUND));

        // 6. 같은 팀의 수락된 참가자라면 방장·팀원 모두 역할을 맡을 수 있다
        CooperativeMissionParticipant target = cooperativeMissionParticipantRepository
                .findByIdAndCooperativeMissionProgressId(request.participantId(), progressId)
                .filter(participant -> participant.getParticipantStatus() == ParticipantStatus.ACCEPTED)
                .orElseThrow(() -> new BusinessException(
                        CooperativeMissionErrorCode.COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND));

        // 7. 같은 카드라도 다른 팀의 배정은 조회·변경하지 않는다
        var savedAssignment = cooperativeMissionRoleProgressRepository
                .findByParticipantCooperativeMissionProgressIdAndRoleCardId(progressId, roleCardId);

        // 8. 같은 담당자이면 수정 시각과 인증 정보를 포함해 기존 행을 그대로 유지한다
        if (savedAssignment.isPresent()
                && savedAssignment.get().getParticipant().getId().equals(target.getId())) {
            return;
        }

        CooperativeMissionRoleProgress assignment;
        if (savedAssignment.isEmpty()) {
            assignment = CooperativeMissionRoleProgress.builder()
                    .participant(target)
                    .roleCard(roleCard)
                    .build();
        } else {
            // 참가자는 복합키의 일부이므로 PK를 수정하지 않고 인증 정보를 보존하여 행을 교체한다.
            CooperativeMissionRoleProgress previous = savedAssignment.get();
            assignment = CooperativeMissionRoleProgress.builder()
                    .participant(target)
                    .roleCard(roleCard)
                    .progressStatus(previous.getProgressStatus())
                    .itemImgUrl(previous.getItemImgUrl())
                    .completedAt(previous.getCompletedAt())
                    .build();
            cooperativeMissionRoleProgressRepository.delete(previous);
            cooperativeMissionRoleProgressRepository.flush();
        }
        cooperativeMissionRoleProgressRepository.save(assignment);
        // 9. 교체 중 실패하면 삭제도 함께 롤백하며 팀 단계·보상은 변경하지 않는다
    }

    /** 본인 역할의 사진을 판정하고 성공 시 Blob URL과 역할 완료 정보만 저장한다. */
    @Transactional
    public SaveCooperativeMissionRoleProgressResponse saveCooperativeMissionRoleProgress(
            Long userId, Long progressId, Long roleCardId, SaveCooperativeMissionRoleProgressRequest request) {
        // 1. 파일 크기·실제 형식·디코딩은 기존 공통 검증을 사용하고 이미지별 오류를 구분한다
        var image = imageValidator.validate(request.itemImage(),
                CooperativeMissionErrorCode.INVALID_IMAGE_FORMAT, CooperativeMissionErrorCode.IMAGE_SIZE_EXCEEDED,
                CooperativeMissionErrorCode.INVALID_IMAGE);

        // 2. 현재 사용자 확인
        userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 3. 팀 진행도 잠금 및 미션·수행 단계 확인 (팀 완료 오류도 통합 단계 오류로 처리한다)
        CooperativeMissionProgress progress = cooperativeMissionProgressRepository.findByIdForUpdate(progressId)
                .orElseThrow(() -> new BusinessException(
                        CooperativeMissionErrorCode.COOPERATIVE_MISSION_PROGRESS_NOT_FOUND));
        if (progress.getCooperativeMission().getStatus() == MissionActivationStatus.INACTIVE) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_INACTIVE);
        }
        if (progress.getMissionStatus() != MissionProgressStatus.IN_PROGRESS
                || progress.getCurrentStep() != PERFORMANCE_STEP) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_STEP_NOT_ALLOWED);
        }

        // 4. 팀·카드 조합의 최신 수행 기록을 잠금 조회하며 없는 배정을 새로 만들지 않는다
        CooperativeMissionRoleProgress roleProgress = cooperativeMissionRoleProgressRepository
                .findByParticipantCooperativeMissionProgressIdAndRoleCardId(progressId, roleCardId)
                .orElseThrow(() -> new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_ROLE_PROGRESS_NOT_FOUND));

        // 5. 방장도 본인에게 배정된 역할만 인증할 수 있다
        var participant = roleProgress.getParticipant();
        if (!participant.getUser().getId().equals(userId)
                || participant.getParticipantStatus() != ParticipantStatus.ACCEPTED) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_ROLE_PROGRESS_ACCESS_DENIED);
        }

        // 6. 완료된 역할은 기존 사진을 덮어쓰거나 다시 업로드하지 않는다
        if (roleProgress.getProgressStatus() == MissionProgressStatus.COMPLETED) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_ROLE_PROGRESS_ALREADY_COMPLETED);
        }

        // 7~8. 판정 실패는 정상 결과이며 Blob 업로드와 역할 변경 없이 반환한다
        var card = roleProgress.getRoleCard();
        boolean verified = cooperativeMissionPhotoVerifier.verify(image.data(), image.format().contentType(),
                card.getRoleName(), card.getRoleDescription(), card.getLocationToFind());
        if (!verified) {
            return SaveCooperativeMissionRoleProgressResponse.of(false);
        }

        // 9. 커밋 실패까지 정리할 수 있는 트랜잭션에서만 원본 파일을 업로드한다
        BlobRollbackCleanup.requireActiveTransaction();
        String blobName = "cooperative_mission_role/" + progressId + "/" + roleCardId + "/"
                + UUID.randomUUID() + image.format().extension();
        String context = "협동 역할 인증 userId=" + userId + ", progressId=" + progressId + ", roleCardId=" + roleCardId;
        UploadedBlob uploaded;
        try {
            uploaded = blobStorageClient.upload(image.data(), blobName, image.format().contentType());
        } catch (RuntimeException exception) {
            log.error("협동 역할 사진 업로드 실패: {}, blobName={}", context, blobName, exception);
            throw exception;
        }
        BlobRollbackCleanup.register(blobStorageClient, uploaded, context);

        try {
            roleProgress.complete(uploaded.url(), LocalDateTime.now(clock));
            cooperativeMissionRoleProgressRepository.saveAndFlush(roleProgress);
        } catch (RuntimeException exception) {
            log.error("협동 역할 인증 DB 저장 실패: {}, blobName={}", context, uploaded.name(), exception);
            throw exception;
        }

        // 10. 팀 단계·완료·보상은 변경하지 않고 역할 인증 결과만 반환한다
        return SaveCooperativeMissionRoleProgressResponse.of(true);
    }

    /** 첫 단계에서 본인 참여를 해제하고 필요한 방장 승계 또는 팀 해산을 처리한다. */
    @Transactional
    public void stopCooperativeMission(Long userId, Long progressId) {
        // 1. 현재 사용자 확인
        userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2. 팀 잠금 및 미션 활성 확인 (완료된 팀도 조회하여 단계 오류로 구분한다)
        CooperativeMissionProgress progress = cooperativeMissionProgressRepository.findByIdForUpdate(progressId)
                .orElseThrow(() -> new BusinessException(
                        CooperativeMissionErrorCode.COOPERATIVE_MISSION_PROGRESS_NOT_FOUND));
        if (progress.getCooperativeMission().getStatus() == MissionActivationStatus.INACTIVE) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_INACTIVE);
        }

        // 3. 잠금 조회로 직전 중단·승계가 반영된 최신 참가 기록에서 본인을 확인한다
        var participants = cooperativeMissionParticipantRepository.findAllByProgressIdForUpdate(progressId);
        CooperativeMissionParticipant leaving = participants.stream()
                .filter(participant -> participant.getUser().getId().equals(userId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        CooperativeMissionErrorCode.COOPERATIVE_MISSION_LEAVE_ACCESS_DENIED));

        // 4. 진행 중인 첫 단계에서만 중단하며 대기 참가자의 요청 취소도 허용한다
        if (progress.getMissionStatus() != MissionProgressStatus.IN_PROGRESS
                || progress.getCurrentStep() != CooperativeMissionProgress.FIRST_STEP) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_STEP_NOT_ALLOWED);
        }

        // 5. 본인 이외의 최신 참가자 목록으로 승계·해산 여부를 판단한다
        var remaining = participants.stream()
                .filter(participant -> !participant.getId().equals(leaving.getId()))
                .toList();

        // 6~8. 마지막 참가자이면 관리 중인 참가자와 팀을 삭제하고 역할은 DB 삭제 연쇄로 정리한다
        if (remaining.isEmpty()) {
            deleteCooperativeMissionTeam(progress, participants);
            return;
        }
        if (leaving.getParticipantRole() == ParticipantRole.HOST) {
            var successor = remaining.stream()
                    .filter(participant -> participant.getParticipantStatus() == ParticipantStatus.ACCEPTED)
                    .min(Comparator.comparing(CooperativeMissionParticipant::getJoinedAt)
                            .thenComparing(CooperativeMissionParticipant::getId));
            if (successor.isEmpty()) {
                // 수락된 승계 후보가 없으면 대기 참가자를 포함한 팀 전체를 해산한다
                deleteCooperativeMissionTeam(progress, participants);
                return;
            }
            // 새 방장의 참가 기록·합류 시각·역할 배정은 유지한다
            successor.get().promoteToHost();
        }

        // 9. 나가는 사람만 삭제하고 역할은 DB 삭제 연쇄로 해제한다. 팀 완료·보상 처리는 하지 않는다
        cooperativeMissionParticipantRepository.delete(leaving);
    }

    /** 관리 중인 참가자도 삭제 상태로 전환하여 팀 삭제 시 남은 참조로 인한 flush 오류를 방지한다. */
    private void deleteCooperativeMissionTeam(CooperativeMissionProgress progress,
                                              List<CooperativeMissionParticipant> participants) {
        cooperativeMissionParticipantRepository.deleteAll(participants);
        cooperativeMissionProgressRepository.delete(progress);
    }

    /** 과거 완료나 일부라도 지급된 이력이 있으면 제외하고, 최초 완료 사용자에게 설정된 보상을 모두 지급한다. */
    private void grantFirstCompletionReward(User user, CooperativeMission mission, Long progressId) {
        boolean previouslyCompleted = cooperativeMissionParticipantRepository
                .findAllByUserIdAndMissionId(user.getId(), mission.getMissionId()).stream()
                .filter(participant -> participant.getParticipantStatus() == ParticipantStatus.ACCEPTED)
                .map(CooperativeMissionParticipant::getCooperativeMissionProgress)
                .anyMatch(team -> !team.getId().equals(progressId)
                        && team.getMissionStatus() == MissionProgressStatus.COMPLETED);
        if (previouslyCompleted) {
            return;
        }

        boolean previouslyGranted = missionRewardStatusRepository
                .findById(new MissionRewardStatusId(mission.getMissionId(), user.getId()))
                .map(status -> status.isArCharacterRewardGranted()
                        || status.isPointRewardGranted() || status.isCouponRewardGranted())
                .orElse(false);
        if (previouslyGranted) {
            return;
        }

        // 공통 지급기는 미지급 항목을 채울 수 있으므로 최초 완료 판단을 통과한 경우에만 호출한다.
        missionRewardGranter.grant(user, mission.getMission(), mission.getArCharacter(),
                mission.getPoint(), mission.getCoupon(), COMPLETION_REWARD_LIMIT);
    }

    /** 새 팀을 첫 단계부터 만들고 현재 사용자를 수락된 방장으로 등록한다. 과거 완료 기록은 유지한다. */
    private CooperativeMissionParticipant start(User user, CooperativeMission cooperativeMission) {
        CooperativeMissionProgress progress = cooperativeMissionProgressRepository.save(
                CooperativeMissionProgress.builder()
                        .cooperativeMission(cooperativeMission)
                        .currentStep(CooperativeMissionProgress.FIRST_STEP)
                        .missionStatus(MissionProgressStatus.IN_PROGRESS)
                        .teamToken(generateTeamToken())
                        .build());

        return cooperativeMissionParticipantRepository.save(CooperativeMissionParticipant.builder()
                .cooperativeMissionProgress(progress)
                .user(user)
                .participantStatus(ParticipantStatus.ACCEPTED)
                .participantRole(ParticipantRole.HOST)
                .joinedAt(LocalDateTime.now(clock))
                .build());
    }

    /** 암호학적으로 안전한 32바이트 난수를 패딩 없는 URL-safe 팀 토큰으로 만든다. */
    private String generateTeamToken() {
        byte[] bytes = new byte[TEAM_TOKEN_BYTE_LENGTH];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
