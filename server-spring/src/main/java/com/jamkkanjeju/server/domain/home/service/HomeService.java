package com.jamkkanjeju.server.domain.home.service;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMission;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionParticipant;
import com.jamkkanjeju.server.domain.cooperativemission.entity.CooperativeMissionProgress;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionParticipantRepository;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionProgressRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionQuizRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionQuizRepository.QuizCount;
import com.jamkkanjeju.server.domain.guestbook.service.GuestbookCounter;
import com.jamkkanjeju.server.domain.home.dto.GetHomeRequest;
import com.jamkkanjeju.server.domain.home.dto.GetHomeResponse;
import com.jamkkanjeju.server.domain.home.dto.GetHomeResponse.MissionRecommendInfo;
import com.jamkkanjeju.server.domain.home.dto.GetHomeResponse.ProgressMissionInfo;
import com.jamkkanjeju.server.domain.map.service.TravelEstimator;
import com.jamkkanjeju.server.domain.map.service.TravelEstimator.TravelEstimate;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.mission.service.MissionCompletionChecker;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMission;
import com.jamkkanjeju.server.domain.treasurehunt.entity.TreasureMissionProgress;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionProgressRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 홈 화면에 필요한 추천 미션, 진행 중인 미션, 방명록 개수, 캐릭터 이미지를 한 번에 조회한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HomeService {

    private final UserRepository userRepository;
    private final CultureMissionProgressRepository cultureMissionProgressRepository;
    private final CultureMissionQuizRepository cultureMissionQuizRepository;
    private final TreasureMissionProgressRepository treasureMissionProgressRepository;
    private final CooperativeMissionParticipantRepository cooperativeMissionParticipantRepository;
    private final MissionCompletionChecker missionCompletionChecker;
    private final MissionRecommender missionRecommender;
    private final GuestbookCounter guestbookCounter;
    private final TravelEstimator travelEstimator;

    /** 현재 사용자와 요청 위치를 기준으로 홈 조회 응답을 구성한다. */
    public GetHomeResponse getHome(Long userId, GetHomeRequest request) {
        // 1. 현재 사용자 확인
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));
        double latitude = request.latitude();
        double longitude = request.longitude();

        // 보물찾기·협동 진행 기록은 추천 제외(3절)와 진행 중인 미션(5절)에 함께 쓰므로 한 번만 조회한다.
        List<TreasureMissionProgress> treasureProgresses = treasureMissionProgressRepository.findAllByUserId(userId);
        List<CooperativeMissionParticipant> participants = cooperativeMissionParticipantRepository.findAllByUserId(userId);

        // 3. 추천 미션 선정
        List<MissionRecommendInfo> missionRecommend = missionRecommender.recommend(latitude, longitude,
                missionCompletionChecker.completedTreasureMissionIds(treasureProgresses),
                missionCompletionChecker.completedCooperativeMissionIds(participants));

        // 5. 진행 중인 미션 조회 + 6. 단계 정보 구성
        List<ProgressMissionInfo> progressMission = new ArrayList<>();
        progressMission.addAll(cultureProgressMissions(userId));
        progressMission.addAll(treasureProgressMissions(treasureProgresses, latitude, longitude));
        progressMission.addAll(cooperativeProgressMissions(participants, latitude, longitude));

        // 7. 방명록 개수 집계
        long guestbookCount = guestbookCounter.countSince(user.getGuestbookLastCheckedAt());

        // 8. 온보딩 캐릭터 이미지 구성
        return GetHomeResponse.of(missionRecommend, progressMission, guestbookCount, user.getOnboardingResult());
    }

    /** 사용자가 진행 중인 문화 미션을 홈 응답 항목으로 만든다. */
    private List<ProgressMissionInfo> cultureProgressMissions(Long userId) {
        List<CultureMissionProgress> progresses = cultureMissionProgressRepository
                .findAllByUserIdAndMissionStatus(userId, MissionProgressStatus.IN_PROGRESS);
        if (progresses.isEmpty()) {
            return List.of();
        }

        List<Long> cultureMissionIds = progresses.stream()
                .map(progress -> progress.getCultureMission().getMissionId())
                .toList();
        Map<Long, Long> quizCounts = cultureMissionQuizRepository.countByCultureMissionIds(cultureMissionIds).stream()
                .collect(Collectors.toMap(QuizCount::getCultureMissionId, QuizCount::getQuizCount));

        return progresses.stream()
                .map(progress -> ProgressMissionInfo.of(
                        progress.getCultureMission().getMission(), null, null, null,
                        Math.toIntExact(quizCounts.getOrDefault(progress.getCultureMission().getMissionId(), 0L)),
                        progress.getCurrentQuizIndex()))
                .toList();
    }

    /** 사용자가 진행 중인 보물찾기 미션을 홈 응답 항목으로 만든다. */
    private List<ProgressMissionInfo> treasureProgressMissions(List<TreasureMissionProgress> progresses,
                                                               double latitude, double longitude) {
        return progresses.stream()
                .filter(progress -> progress.getMissionStatus() == MissionProgressStatus.IN_PROGRESS)
                .map(progress -> {
                    TreasureMission treasureMission = progress.getTreasureMission();
                    TravelEstimate estimate = travelEstimator.estimate(latitude, longitude, treasureMission.getLocation());
                    return ProgressMissionInfo.of(
                            treasureMission.getMission(), treasureMission.getLocation(),
                            estimate.distanceMeter(), estimate.durationMinutes(),
                            treasureMission.getItemTotalCount(), progress.getFoundItemCount());
                })
                .toList();
    }

    /** 사용자가 참가한 팀이 진행 중인 협동 미션을 홈 응답 항목으로 만든다. */
    private List<ProgressMissionInfo> cooperativeProgressMissions(List<CooperativeMissionParticipant> participants,
                                                                  double latitude, double longitude) {
        return participants.stream()
                .map(CooperativeMissionParticipant::getCooperativeMissionProgress)
                .filter(progress -> progress.getMissionStatus() == MissionProgressStatus.IN_PROGRESS)
                .map(progress -> toCooperativeProgressMission(progress, latitude, longitude))
                .toList();
    }

    /** 협동 미션 팀 진행도 하나를 홈 응답 항목으로 바꾼다. */
    private ProgressMissionInfo toCooperativeProgressMission(CooperativeMissionProgress progress,
                                                             double latitude, double longitude) {
        CooperativeMission cooperativeMission = progress.getCooperativeMission();
        TravelEstimate estimate = travelEstimator.estimate(latitude, longitude, cooperativeMission.getLocation());
        return ProgressMissionInfo.of(
                cooperativeMission.getMission(), cooperativeMission.getLocation(),
                estimate.distanceMeter(), estimate.durationMinutes(),
                cooperativeMission.getMission().getMissionType().getSteps().size(), progress.getCurrentStep());
    }
}
