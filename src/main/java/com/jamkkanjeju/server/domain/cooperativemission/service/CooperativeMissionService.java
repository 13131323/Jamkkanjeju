package com.jamkkanjeju.server.domain.cooperativemission.service;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
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

/** 사용자가 참가·대기 중인 협동 미션 팀을 이어가거나 새 팀을 만들고 진행도 ID와 허용된 팀 토큰을 제공한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CooperativeMissionService {

    private static final int TEAM_TOKEN_BYTE_LENGTH = 32;

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
