package com.jamkkanjeju.server.domain.culturemission.support;

import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionQuiz;
import com.jamkkanjeju.server.domain.home.support.HomeFixtures;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionTypeCode;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.test.util.ReflectionTestUtils;

/** 문화 미션 단위 테스트에서 공통으로 쓰는 문화 미션·진행도·퀴즈 생성 도우미이다. */
public final class CultureMissionFixtures {

    public static final LocalDateTime LAST_COMPLETED_AT = LocalDateTime.of(2026, 10, 1, 12, 0);

    private CultureMissionFixtures() {
    }

    /** 공통 미션 ID와 활성 상태로 문화 미션을 만든다. */
    public static CultureMission cultureMission(Long missionId, MissionActivationStatus status) {
        CultureMission cultureMission = CultureMission.builder()
                .mission(HomeFixtures.mission(missionId, MissionTypeCode.CULTURE))
                .status(status)
                .build();
        ReflectionTestUtils.setField(cultureMission, "missionId", missionId);
        return cultureMission;
    }

    /** 진행 상태와 퀴즈 번호, 정답 수, 마지막 완료 시각을 지정한 진행도를 만든다. */
    public static CultureMissionProgress progress(Long id, User user, CultureMission cultureMission,
                                                  MissionProgressStatus status, int currentQuizIndex,
                                                  int correctCount, LocalDateTime lastCompletedAt) {
        CultureMissionProgress progress = CultureMissionProgress.builder()
                .user(user)
                .cultureMission(cultureMission)
                .missionStatus(status)
                .currentQuizIndex(currentQuizIndex)
                .correctCount(correctCount)
                .lastCompletedAt(lastCompletedAt)
                .build();
        ReflectionTestUtils.setField(progress, "id", id);
        return progress;
    }

    /** 이미지·힌트·해설이 모두 있는 객관식 퀴즈를 만든다. */
    public static CultureMissionQuiz multipleChoiceQuiz(CultureMission cultureMission, int quizIndex) {
        return CultureMissionQuiz.builder()
                .cultureMission(cultureMission)
                .quizIndex(quizIndex)
                .imgUrl("https://example.com/quiz-" + quizIndex + ".png")
                .question("객관식 문제 " + quizIndex)
                .options(List.of("하르방", "하라범", "하르봉", "하르범"))
                .answer("하르방")
                .hint("힌트 " + quizIndex)
                .explanation("해설 " + quizIndex)
                .build();
    }

    /** 이미지·선택지·힌트·해설이 모두 없는 주관식 퀴즈를 만든다. */
    public static CultureMissionQuiz shortAnswerQuiz(CultureMission cultureMission, int quizIndex) {
        return CultureMissionQuiz.builder()
                .cultureMission(cultureMission)
                .quizIndex(quizIndex)
                .question("주관식 문제 " + quizIndex)
                .answer("많이")
                .build();
    }
}
