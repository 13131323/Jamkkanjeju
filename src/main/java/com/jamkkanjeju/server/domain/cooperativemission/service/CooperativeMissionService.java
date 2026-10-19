package com.jamkkanjeju.server.domain.cooperativemission.service;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.dto.JoinCooperativeMissionResponse;
import com.jamkkanjeju.server.domain.cooperativemission.dto.StartCooperativeMissionResponse;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionProgress;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantRole;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantStatus;
import com.jamkkanjeju.server.domain.cooperativemission.exception.CooperativeMissionErrorCode;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionProgressRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 협동 미션 팀을 시작·이어가거나 초대 URL을 통한 참가 요청을 처리한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CooperativeMissionService {

    private static final int TEAM_TOKEN_BYTE_LENGTH = 32;
    private static final long MAX_PARTICIPANT_COUNT = 6L;

    private final UserRepository userRepository;
    private final CooperativeMissionRepository cooperativeMissionRepository;
    private final CooperativeMissionProgressRepository cooperativeMissionProgressRepository;
    private final CooperativeMissionParticipantRepository cooperativeMissionParticipantRepository;
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
