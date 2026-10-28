package com.jamkkanjeju.server.domain.mission.service;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionRepository;
import com.jamkkanjeju.server.domain.home.entity.Coupon;
import com.jamkkanjeju.server.domain.mission.dto.GetMissionHomeResponse;
import com.jamkkanjeju.server.domain.mission.dto.GetMissionHomeResponse.RemainingReward;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionRewardStatusId;
import com.jamkkanjeju.server.domain.mission.entity.MissionStep;
import com.jamkkanjeju.server.domain.mission.exception.MissionErrorCode;
import com.jamkkanjeju.server.domain.mission.repository.MissionRepository;
import com.jamkkanjeju.server.domain.mission.repository.MissionRewardStatusRepository;
import com.jamkkanjeju.server.domain.treasurehunt.entity.ArCharacter;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionRepository;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 미션의 공통 정보와 현재 사용자에게 아직 지급되지 않은 보상을 조회한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MissionService {

    private final UserRepository userRepository;
    private final MissionRepository missionRepository;
    private final CultureMissionRepository cultureMissionRepository;
    private final CooperativeMissionRepository cooperativeMissionRepository;
    private final TreasureMissionRepository treasureMissionRepository;
    private final MissionRewardStatusRepository missionRewardStatusRepository;

    /** 사용자·미션·활성 상태를 확인한 뒤 저장 상태를 변경하지 않고 미션 홈을 구성한다. */
    public GetMissionHomeResponse getMissionHome(Long userId, Long missionId) {
        // 1. 현재 사용자 확인
        userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2. 미션 식별 및 활성 상태 확인
        Mission mission = missionRepository.findById(missionId)
                .orElseThrow(() -> new BusinessException(MissionErrorCode.MISSION_NOT_FOUND));
        RewardSettings settings = findRewardSettings(mission);
        if (settings.status() == MissionActivationStatus.INACTIVE) {
            throw new BusinessException(MissionErrorCode.MISSION_INACTIVE);
        }

        // 3. 미션 공통 정보 구성
        List<MissionStep> steps = mission.getMissionType().getSteps().stream()
                .sorted(Comparator.comparingInt(MissionStep::step))
                .toList();

        // 4. 보상 설정 및 사용자별 지급 상태 확인 (기록이 없어도 새로 만들지 않는다)
        MissionRewardStatus rewardStatus = missionRewardStatusRepository
                .findById(new MissionRewardStatusId(missionId, userId))
                .orElse(null);

        // 5. 남은 보상 구성 (이미 지급된 항목만 제외하고 나머지 설정은 유지한다)
        ArCharacter character = rewardStatus != null && rewardStatus.isArCharacterRewardGranted()
                ? null : settings.arCharacter();
        Integer point = rewardStatus != null && rewardStatus.isPointRewardGranted()
                ? null : settings.point();
        Coupon coupon = rewardStatus != null && rewardStatus.isCouponRewardGranted()
                ? null : settings.coupon();

        RemainingReward remainingReward = RemainingReward.of(character, point, coupon);
        return GetMissionHomeResponse.of(mission, steps, remainingReward);
    }

    /** 공통 미션의 유형에 해당하는 상세 한 건에서 활성 상태와 보상 설정을 가져온다. */
    private RewardSettings findRewardSettings(Mission mission) {
        Long missionId = mission.getId();
        return switch (mission.getMissionType().getType()) {
            case CULTURE -> {
                CultureMission detail = cultureMissionRepository.findByMissionId(missionId)
                        .orElseThrow(() -> new BusinessException(MissionErrorCode.MISSION_NOT_FOUND));
                yield new RewardSettings(
                        detail.getStatus(), detail.getArCharacter(), detail.getPoint(), detail.getCoupon());
            }
            case COOPERATIVE -> {
                CooperativeMission detail = cooperativeMissionRepository.findByMissionId(missionId)
                        .orElseThrow(() -> new BusinessException(MissionErrorCode.MISSION_NOT_FOUND));
                yield new RewardSettings(
                        detail.getStatus(), detail.getArCharacter(), detail.getPoint(), detail.getCoupon());
            }
            case TREASURE -> {
                TreasureMission detail = treasureMissionRepository.findByMissionId(missionId)
                        .orElseThrow(() -> new BusinessException(MissionErrorCode.MISSION_NOT_FOUND));
                yield new RewardSettings(
                        detail.getStatus(), detail.getArCharacter(), detail.getPoint(), detail.getCoupon());
            }
        };
    }

    /** 유형별 상세에서 가져온 활성 상태와 보상 설정을 동일한 형태로 전달한다. */
    private record RewardSettings(
            MissionActivationStatus status, ArCharacter arCharacter, Integer point, Coupon coupon) {
    }
}
