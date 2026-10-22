package com.jamkkanjeju.server.domain.cooperativemission.service;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.dto.GetCooperativeMissionStatusRequest;
import com.jamkkanjeju.server.domain.cooperativemission.dto.GetCooperativeMissionStatusResponse;
import com.jamkkanjeju.server.domain.cooperativemission.dto.GetCooperativeMissionStatusResponse.NextLocation;
import com.jamkkanjeju.server.domain.cooperativemission.dto.GetCooperativeMissionStatusResponse.NextMission;
import com.jamkkanjeju.server.domain.cooperativemission.dto.GetCooperativeMissionStatusResponse.Reward;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionProgress;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantRole;
import com.jamkkanjeju.server.domain.cooperativemission.entity.ParticipantStatus;
import com.jamkkanjeju.server.domain.cooperativemission.exception.CooperativeMissionErrorCode;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionProgressRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRoleProgressRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeRoleCardRepository;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.service.NextLocationRecommender;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatusId;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.mission.service.NextMissionSelector;
import java.util.Comparator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 협동 미션 폴링을 위한 팀 상태와 사용자별 최초 완료 보상 정보를 읽기 전용으로 조회한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CooperativeMissionStatusService {

    private final UserRepository userRepository;
    private final CooperativeMissionProgressRepository cooperativeMissionProgressRepository;
    private final CooperativeMissionParticipantRepository cooperativeMissionParticipantRepository;
    private final CooperativeRoleCardRepository cooperativeRoleCardRepository;
    private final CooperativeMissionRoleProgressRepository cooperativeMissionRoleProgressRepository;
    private final MissionRewardStatusRepository missionRewardStatusRepository;
    private final NextLocationRecommender nextLocationRecommender;
    private final NextMissionSelector nextMissionSelector;
    private final TourApiClient tourApiClient;

    /** 팀 참가 여부를 검증하고 진행 중 참가·역할 상태 또는 완료 장소·본인 보상·다음 장소를 반환한다. */
    public GetCooperativeMissionStatusResponse getCooperativeMissionStatus(
            Long userId, Long progressId, GetCooperativeMissionStatusRequest request) {
        // 1. 현재 사용자 확인 (기존 API와 동일하게 없는 사용자 인증 정보를 처리한다)
        userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2. 진행도·미션 확인 (완료된 팀도 조회하며 쓰기 잠금을 사용하지 않는다)
        CooperativeMissionProgress progress = cooperativeMissionProgressRepository.findWithDetailsById(progressId)
                .orElseThrow(() -> new BusinessException(
                        CooperativeMissionErrorCode.COOPERATIVE_MISSION_PROGRESS_NOT_FOUND));
        if (progress.getCooperativeMission().getStatus() == MissionActivationStatus.INACTIVE) {
            throw new BusinessException(CooperativeMissionErrorCode.COOPERATIVE_MISSION_INACTIVE);
        }

        // 3. 완료 응답에서도 현재 사용자가 해당 팀 참가자인지 먼저 확인한다
        CooperativeMissionParticipant currentParticipant = cooperativeMissionParticipantRepository
                .findByCooperativeMissionProgressIdAndUserId(progressId, userId)
                .orElseThrow(() -> new BusinessException(
                        CooperativeMissionErrorCode.COOPERATIVE_MISSION_PARTICIPANT_NOT_FOUND));

        // 4. 저장된 팀 상태로 응답을 구분하며 조회 중 완료 처리나 보상 지급은 하지 않는다
        if (progress.getMissionStatus() == MissionProgressStatus.COMPLETED) {
            return GetCooperativeMissionStatusResponse.completed(
                    progress, completedReward(userId, progress, currentParticipant),
                    nextLocation(progress.getCooperativeMission().getLocation(), request));
        }

        // 5. 방장 우선, 나머지 참가자는 생성 시각순으로 정렬한다
        var participants = cooperativeMissionParticipantRepository.findAllByCooperativeMissionProgressId(progressId)
                .stream()
                .sorted(Comparator.comparing((CooperativeMissionParticipant participant) ->
                                participant.getParticipantRole() != ParticipantRole.HOST)
                        .thenComparing(CooperativeMissionParticipant::getCreatedAt))
                .toList();

        // 6~7. 첫 단계부터 카드·역할 수행 목록을 반환하고 실제 수행 기록으로 집계한다
        var roleCards = cooperativeRoleCardRepository.findAllByOrderByIdAsc();
        var roleProgresses = cooperativeMissionRoleProgressRepository
                .findAllByParticipantCooperativeMissionProgressIdOrderByParticipantIdAscRoleCardIdAsc(progressId);
        int completedRoleCount = Math.toIntExact(roleProgresses.stream()
                .filter(role -> role.getProgressStatus() == MissionProgressStatus.COMPLETED).count());
        return GetCooperativeMissionStatusResponse.inProgress(
                progress, currentParticipant, participants, roleCards, roleProgresses,
                completedRoleCount, roleProgresses.size());
    }

    /** 본인의 최초 완료 팀에서만 지급된 보상을 표시하며 재도전 팀이나 미지급이면 빈 보상 객체를 반환한다. */
    private Reward completedReward(Long userId, CooperativeMissionProgress progress,
                                   CooperativeMissionParticipant currentParticipant) {
        if (currentParticipant.getParticipantStatus() != ParticipantStatus.ACCEPTED) {
            return Reward.of(null, null, null);
        }
        var mission = progress.getCooperativeMission();
        var firstCompleted = cooperativeMissionParticipantRepository
                .findAllByUserIdAndMissionId(userId, mission.getMissionId()).stream()
                .filter(participant -> participant.getParticipantStatus() == ParticipantStatus.ACCEPTED)
                .map(CooperativeMissionParticipant::getCooperativeMissionProgress)
                .filter(team -> team.getMissionStatus() == MissionProgressStatus.COMPLETED)
                .min(Comparator.comparing(CooperativeMissionProgress::getCompletedAt)
                        .thenComparing(CooperativeMissionProgress::getId));
        if (firstCompleted.isEmpty() || !firstCompleted.get().getId().equals(progress.getId())) {
            return Reward.of(null, null, null);
        }

        // 누적 지급 상태만으로 재도전 팀에 과거 보상을 표시하지 않는다. 최초 완료 팀일 때만 항목을 읽는다.
        return missionRewardStatusRepository.findById(new MissionRewardStatusId(mission.getMissionId(), userId))
                .map(status -> Reward.of(
                        status.isArCharacterRewardGranted() ? mission.getArCharacter() : null,
                        status.isPointRewardGranted() ? mission.getPoint() : null,
                        status.isCouponRewardGranted() ? mission.getCoupon() : null))
                .orElseGet(() -> Reward.of(null, null, null));
    }

    /** 완료한 장소를 제외해 공통 추천을 호출하고, 후보가 없으면 null을 반환한다. */
    private NextLocation nextLocation(Location completedLocation, GetCooperativeMissionStatusRequest request) {
        Long excludedLocationId = completedLocation != null ? completedLocation.getId() : null;
        return nextLocationRecommender.recommend(request.latitude(), request.longitude(), excludedLocationId)
                .map(recommended -> {
                    Location location = recommended.location();
                    String imageUrl = tourApiClient.getLocationImageUrl(location.getContentId());
                    NextMission mission = nextMissionSelector.pick(location.getId()).map(NextMission::from).orElse(null);
                    return NextLocation.of(location, imageUrl, recommended.distanceMeter(), mission);
                })
                .orElse(null);
    }
}
