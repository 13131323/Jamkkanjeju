package com.jamkkanjeju.server.domain.culturemission.service;

import com.jamkkanjeju.server.common.client.TourApiClient;
import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.cooperativemission.repository.CooperativeMissionRepository;
import com.jamkkanjeju.server.domain.culturemission.dto.SaveCultureMissionProgressLocationRequest;
import com.jamkkanjeju.server.domain.culturemission.dto.SaveCultureMissionProgressRequest;
import com.jamkkanjeju.server.domain.culturemission.dto.SaveCultureMissionProgressResponse;
import com.jamkkanjeju.server.domain.culturemission.dto.SaveCultureMissionProgressResponse.NextLocation;
import com.jamkkanjeju.server.domain.culturemission.dto.SaveCultureMissionProgressResponse.NextMission;
import com.jamkkanjeju.server.domain.culturemission.dto.SaveCultureMissionProgressResponse.Reward;
import com.jamkkanjeju.server.domain.culturemission.dto.StartCultureMissionResponse;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionQuiz;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionQuizId;
import com.jamkkanjeju.server.domain.culturemission.exception.CultureMissionErrorCode;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionProgressRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionQuizRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionRepository;
import com.jamkkanjeju.server.domain.culturemission.service.CultureMissionRewardGranter.GrantedReward;
import com.jamkkanjeju.server.domain.map.entity.Location;
import com.jamkkanjeju.server.domain.map.service.NextLocationRecommender;
import com.jamkkanjeju.server.domain.map.service.NextLocationRecommender.RecommendedLocation;
import com.jamkkanjeju.server.domain.mission.entity.Mission;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.treasurehunt.repository.TreasureMissionRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 사용자의 문화 미션 진행을 시작하거나 이어서 할 수 있게 진행도와 문제를 제공하고, 제출한 답변을 채점해 진행도를 저장한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CultureMissionService {

    private final UserRepository userRepository;
    private final CultureMissionRepository cultureMissionRepository;
    private final CultureMissionProgressRepository cultureMissionProgressRepository;
    private final CultureMissionQuizRepository cultureMissionQuizRepository;
    private final CooperativeMissionRepository cooperativeMissionRepository;
    private final TreasureMissionRepository treasureMissionRepository;
    private final CultureMissionRewardGranter cultureMissionRewardGranter;
    private final NextLocationRecommender nextLocationRecommender;
    private final TourApiClient tourApiClient;
    private final Clock clock;

    /** 문화 미션을 처음 시작하거나, 진행 중이면 이어서, 완료했으면 처음부터 다시 시작하고 풀 문제를 돌려준다. */
    @Transactional
    public StartCultureMissionResponse startCultureMission(Long userId, Long missionId) {
        // 1. 현재 사용자 확인
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2. 문화 미션 확인 (확인 전에는 진행도를 만들거나 초기화하지 않는다)
        CultureMission cultureMission = cultureMissionRepository.findById(missionId)
                .orElseThrow(() -> new BusinessException(CultureMissionErrorCode.CULTURE_MISSION_NOT_FOUND));
        if (cultureMission.getStatus() == MissionActivationStatus.INACTIVE) {
            throw new BusinessException(CultureMissionErrorCode.CULTURE_MISSION_INACTIVE);
        }

        // 3. 현재 진행도 조회 + 4. 진행 상태에 따른 처리
        Optional<CultureMissionProgress> savedProgress = cultureMissionProgressRepository
                .findByUserIdAndCultureMissionMissionId(userId, missionId);
        boolean created = savedProgress.isEmpty();
        CultureMissionProgress progress = savedProgress
                .map(this::resumeOrRestart)
                .orElseGet(() -> start(user, cultureMission));

        // 5. 퀴즈 조회 및 응답 구성
        List<CultureMissionQuiz> quizzes = cultureMissionQuizRepository
                .findAllByIdCultureMissionIdOrderByIdQuizIndexAsc(missionId);
        return StartCultureMissionResponse.of(progress, quizzes, created);
    }

    /** 처음 시작하는 사용자의 진행도를 첫 퀴즈부터 새로 만든다. */
    private CultureMissionProgress start(User user, CultureMission cultureMission) {
        return cultureMissionProgressRepository.save(CultureMissionProgress.builder()
                .cultureMission(cultureMission)
                .user(user)
                .missionStatus(MissionProgressStatus.IN_PROGRESS)
                .currentQuizIndex(1)
                .correctCount(0)
                .build());
    }

    /** 진행 중인 진행도는 그대로 이어 쓰고, 완료한 진행도는 같은 진행도를 처음부터 다시 시작한다. */
    private CultureMissionProgress resumeOrRestart(CultureMissionProgress progress) {
        if (progress.getMissionStatus() == MissionProgressStatus.COMPLETED) {
            progress.restart();
        }
        return progress;
    }

    /**
     * 제출한 답변을 채점해 진행도를 저장한다. 마지막 문제가 아니면 다음 문제로 넘어가고,
     * 마지막 문제면 미션을 완료해 보상을 지급하고 다음 장소를 추천한다.
     */
    @Transactional
    public SaveCultureMissionProgressResponse saveCultureMissionProgress(
            Long userId, Long progressId,
            SaveCultureMissionProgressLocationRequest location, SaveCultureMissionProgressRequest request) {
        // 1. 현재 사용자 확인
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.UNAUTHORIZED));

        // 2. 진행도와 문화 미션 확인
        CultureMissionProgress progress = cultureMissionProgressRepository
                .findByIdAndUserIdAndMissionStatus(progressId, userId, MissionProgressStatus.IN_PROGRESS)
                .orElseThrow(() -> new BusinessException(CultureMissionErrorCode.CULTURE_MISSION_PROGRESS_NOT_FOUND));
        CultureMission cultureMission = progress.getCultureMission();
        if (cultureMission.getStatus() == MissionActivationStatus.INACTIVE) {
            throw new BusinessException(CultureMissionErrorCode.CULTURE_MISSION_INACTIVE);
        }

        // 3. 퀴즈 확인 및 서버 채점
        if (request.quizIndex() != progress.getCurrentQuizIndex()) {
            throw new BusinessException(CultureMissionErrorCode.CULTURE_MISSION_QUIZ_INDEX_MISMATCH);
        }
        Long missionId = cultureMission.getMissionId();
        CultureMissionQuiz quiz = cultureMissionQuizRepository
                .findById(new CultureMissionQuizId(missionId, request.quizIndex()))
                .orElseThrow(() -> new IllegalStateException(
                        "진행도의 현재 퀴즈가 존재하지 않습니다."
                        + " missionId=" + missionId
                        + ", quizIndex=" + request.quizIndex()
                ));
        boolean correct = quiz.getAnswer().equals(request.answer());

        // 4. 진행 중과 완료 분기
        int quizCount = (int) cultureMissionQuizRepository.countByIdCultureMissionId(missionId);
        if (progress.getCurrentQuizIndex() < quizCount) {
            // 4.1 진행 중 처리
            progress.moveToNextQuiz(correct);
            return SaveCultureMissionProgressResponse.inProgress(correct, quiz, progress, quizCount);
        }

        // 4.2 완료 처리
        progress.completeLastQuiz(correct, LocalDateTime.now(clock));

        // 5. 보상 계산과 중복 지급 방지 + 6. 보상 저장
        GrantedReward grantedReward = cultureMissionRewardGranter.grant(user, cultureMission, progress.getCorrectCount());

        // 7. 다음 장소 추천
        RecommendedLocation recommended = nextLocationRecommender
                .recommend(location.latitude(), location.longitude())
                .orElseThrow(() -> new IllegalStateException(
                        "문화 미션 완료 후 추천 가능한 장소가 없습니다."
                        + " userId=" + userId
                        + ", progressId=" + progressId
                ));
        Location nextLocation = recommended.location();
        String locationImageUrl = tourApiClient.getLocationImageUrl(nextLocation.getContentId());

        // 8. 다음 장소의 미션 구성 + 9. 응답 구성
        return SaveCultureMissionProgressResponse.completed(
                correct, quiz, progress, quizCount,
                NextLocation.of(nextLocation, locationImageUrl, recommended.distanceMeter(),
                        pickNextMission(nextLocation.getId())),
                Reward.of(grantedReward.arCharacter(), grantedReward.point(), grantedReward.coupon()));
    }

    /** 장소에 연결된 활성 협동·보물찾기 미션 중 하나를 무작위로 고른다. 없으면 null이다. */
    private NextMission pickNextMission(Long locationId) {
        List<Mission> candidates = new ArrayList<>();
        cooperativeMissionRepository.findAllByLocationIdAndStatus(locationId, MissionActivationStatus.ACTIVE)
                .forEach(cooperativeMission -> candidates.add(cooperativeMission.getMission()));
        treasureMissionRepository.findAllByLocationIdAndStatus(locationId, MissionActivationStatus.ACTIVE)
                .forEach(treasureMission -> candidates.add(treasureMission.getMission()));
        if (candidates.isEmpty()) {
            return null;
        }
        return NextMission.from(candidates.get(ThreadLocalRandom.current().nextInt(candidates.size())));
    }
}
