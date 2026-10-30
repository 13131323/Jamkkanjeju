package com.jamkkanjeju.server.domain.mypage.service;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionProgress;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionProgressRepository;
import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.map.dto.GetLocationMapModalResponse.RewardDetail;
import com.jamkkanjeju.server.domain.map.repository.VisitedLocationRepository;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatus;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.mission.service.MissionCompletionChecker;
import com.jamkkanjeju.server.domain.mypage.dto.GetTravelEndingElementsResponse;
import com.jamkkanjeju.server.domain.mypage.dto.GetTravelEndingElementsResponse.CompletedMissionInfo;
import com.jamkkanjeju.server.domain.mypage.dto.GetTravelEndingElementsResponse.VisitedLocationInfo;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionProgressRepository;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 방문·완료 내역과 보상을 읽어 엽서 선택 요소를 구성하며 저장 상태는 변경하지 않는다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TravelEndingElementsService {
    private final UserRepository userRepository;
    private final VisitedLocationRepository visitedLocationRepository;
    private final CultureMissionProgressRepository cultureMissionProgressRepository;
    private final TreasureMissionProgressRepository treasureMissionProgressRepository;
    private final CooperativeMissionParticipantRepository cooperativeMissionParticipantRepository;
    private final MissionRewardStatusRepository missionRewardStatusRepository;
    private final MissionCompletionChecker missionCompletionChecker;

    /** 현재 사용자의 방문 장소와 활성 완료 미션을 최신순으로 조합한다. */
    public GetTravelEndingElementsResponse getTravelEndingElements(Long userId) {
        // 1. 현재 사용자 확인과 보유 포인트
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2. 최근 방문순의 실제 장소. 사용자·장소 조합은 유일하다.
        List<VisitedLocationInfo> locations = visitedLocationRepository.findAllByUserId(userId).stream()
                .map(visited -> VisitedLocationInfo.from(visited.getLocation())).toList();

        // 3~4. 활성 완료 내역을 공통 미션별 가장 최근 한 건으로 모은다.
        Map<Long, CompletedMission> latest = new HashMap<>();
        collectCulture(userId, latest);
        collectTreasure(userId, latest);
        collectCooperative(userId, latest);
        List<CompletedMission> completed = latest.values().stream()
                .sorted(Comparator.comparing(CompletedMission::completedAt).reversed()
                        .thenComparing(item -> item.mission().getMissionType().getType().name())
                        .thenComparing(item -> item.mission().getId()))
                .toList();

        // 5. 가장 최근 팀에 한정하지 않고 본인·공통 미션별 지급 상태를 한 번에 조회한다.
        List<Long> missionIds = completed.stream().map(item -> item.mission().getId()).toList();
        Map<Long, MissionRewardStatus> rewards = missionIds.isEmpty() ? Map.of()
                : missionRewardStatusRepository.findAllByIdUserIdAndIdMissionIdIn(userId, missionIds).stream()
                        .collect(Collectors.toMap(status -> status.getId().getMissionId(), Function.identity()));
        List<CompletedMissionInfo> missions = completed.stream().map(item -> CompletedMissionInfo.of(
                item.mission(), item.locationTitle(), item.completedAt(),
                RewardDetail.of(item.arCharacter(), item.point(), item.coupon(), rewards.get(item.mission().getId()))))
                .toList();

        // 6. 최종 목록 길이와 저장된 포인트를 사용하며 별도 상태 갱신은 하지 않는다.
        return GetTravelEndingElementsResponse.of(user.getPoint(), locations, missions);
    }

    /** 문화 미션은 장소 없이 실제 마지막 완료 시각과 활성 상태를 확인한다. */
    private void collectCulture(Long userId, Map<Long, CompletedMission> latest) {
        for (CultureMissionProgress progress : cultureMissionProgressRepository
                .findAllWithRewardsByUserIdAndMissionStatus(userId, MissionProgressStatus.COMPLETED)) {
            CultureMission mission = progress.getCultureMission();
            if (mission.getStatus() != MissionActivationStatus.ACTIVE || progress.getLastCompletedAt() == null) continue;
            keepLatest(latest, new CompletedMission(mission.getMission(), null, progress.getLastCompletedAt(),
                    mission.getArCharacter(), mission.getPoint(), mission.getCoupon()));
        }
    }

    /** 보물찾기는 완료 상태·완료 시각·활성 미션·실제 장소를 모두 확인한다. */
    private void collectTreasure(Long userId, Map<Long, CompletedMission> latest) {
        for (TreasureMissionProgress progress : treasureMissionProgressRepository
                .findAllWithRewardsByUserIdAndMissionStatus(userId, MissionProgressStatus.COMPLETED)) {
            TreasureMission mission = progress.getTreasureMission();
            if (!missionCompletionChecker.isCompleted(progress) || progress.getCompletedAt() == null
                    || mission.getStatus() != MissionActivationStatus.ACTIVE || mission.getLocation() == null) continue;
            keepLatest(latest, new CompletedMission(mission.getMission(), mission.getLocation().getTitle(),
                    progress.getCompletedAt(), mission.getArCharacter(), mission.getPoint(), mission.getCoupon()));
        }
    }

    /** 수락한 완료 팀만 포함하고 같은 협동 미션의 팀별 이력을 모은다. */
    private void collectCooperative(Long userId, Map<Long, CompletedMission> latest) {
        for (CooperativeMissionParticipant participant : cooperativeMissionParticipantRepository.findAllWithRewardsByUserId(userId)) {
            if (!missionCompletionChecker.isCompleted(participant)) continue;
            CooperativeMissionProgress progress = participant.getCooperativeMissionProgress();
            CooperativeMission mission = progress.getCooperativeMission();
            if (progress.getCompletedAt() == null || mission.getStatus() != MissionActivationStatus.ACTIVE
                    || mission.getLocation() == null) continue;
            keepLatest(latest, new CompletedMission(mission.getMission(), mission.getLocation().getTitle(),
                    progress.getCompletedAt(), mission.getArCharacter(), mission.getPoint(), mission.getCoupon()));
        }
    }

    /** 동일 공통 미션의 완료 기록은 가장 최근 한 건만 유지한다. */
    private void keepLatest(Map<Long, CompletedMission> latest, CompletedMission candidate) {
        latest.merge(candidate.mission().getId(), candidate,
                (saved, incoming) -> incoming.completedAt().isAfter(saved.completedAt()) ? incoming : saved);
    }

    /** 응답 변환 전 정렬·중복 제거에 사용하는 내부 완료 내역이다. */
    private record CompletedMission(Mission mission, String locationTitle, LocalDateTime completedAt,
                                    ArCharacter arCharacter, Integer point, Coupon coupon) { }
}
