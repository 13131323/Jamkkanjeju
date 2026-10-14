package com.jamkkanjeju.server.domain.culturemission.service;

import com.jamkkanjeju.server.common.exception.BusinessException;
import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.culturemission.dto.StartCultureMissionResponse;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionQuiz;
import com.jamkkanjeju.server.domain.culturemission.exception.CultureMissionErrorCode;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionProgressRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionQuizRepository;
import com.jamkkanjeju.server.domain.culturemission.repository.CultureMissionRepository;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 사용자의 문화 미션 진행을 시작하거나 이어서 할 수 있게 진행도와 문제를 제공한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CultureMissionService {

    private final UserRepository userRepository;
    private final CultureMissionRepository cultureMissionRepository;
    private final CultureMissionProgressRepository cultureMissionProgressRepository;
    private final CultureMissionQuizRepository cultureMissionQuizRepository;

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
}
