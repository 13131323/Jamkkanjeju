package com.jamkkanjeju.server.domain.culturemission.dto;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.culturemission.support.CultureMissionFixtures.cultureMission;
import static com.jamkkanjeju.server.domain.culturemission.support.CultureMissionFixtures.multipleChoiceQuiz;
import static com.jamkkanjeju.server.domain.culturemission.support.CultureMissionFixtures.progress;
import static com.jamkkanjeju.server.domain.culturemission.support.CultureMissionFixtures.shortAnswerQuiz;
import static org.assertj.core.api.Assertions.assertThat;

import com.jamkkanjeju.server.domain.culturemission.dto.StartCultureMissionResponse.QuizDetail;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMission;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.mission.entity.MissionActivationStatus;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import java.util.List;
import org.junit.jupiter.api.Test;

class StartCultureMissionResponseTest {

    private final CultureMission cultureMission = cultureMission(31L, MissionActivationStatus.ACTIVE);
    private final CultureMissionProgress progress = progress(7L, activeUser(15L), cultureMission,
            MissionProgressStatus.IN_PROGRESS, 2, 1, null);

    @Test
    void 진행도_ID와_현재_퀴즈_번호를_진행도에서_가져온다() {
        StartCultureMissionResponse response = StartCultureMissionResponse.of(progress,
                List.of(multipleChoiceQuiz(cultureMission, 1)), false);

        assertThat(response.cultureMissionProgressId()).isEqualTo(7L);
        assertThat(response.currentQuizNumber()).isEqualTo(2);
    }

    @Test
    void 전체_문제_수는_목록_크기이고_전달받은_순서를_유지한다() {
        StartCultureMissionResponse response = StartCultureMissionResponse.of(progress, List.of(
                multipleChoiceQuiz(cultureMission, 1),
                shortAnswerQuiz(cultureMission, 3),
                multipleChoiceQuiz(cultureMission, 2)), false);

        assertThat(response.quizCount()).isEqualTo(3);
        assertThat(response.quizDetails()).extracting(QuizDetail::quizIndex).containsExactly(1, 3, 2);
    }

    @Test
    void 문제_번호_이미지_질문_선택지_힌트를_그대로_옮긴다() {
        QuizDetail detail = StartCultureMissionResponse.of(progress,
                List.of(multipleChoiceQuiz(cultureMission, 1)), false).quizDetails().getFirst();

        assertThat(detail.quizIndex()).isEqualTo(1);
        assertThat(detail.imgUrl()).isEqualTo("https://example.com/quiz-1.png");
        assertThat(detail.question()).isEqualTo("객관식 문제 1");
        assertThat(detail.options()).containsExactly("하르방", "하라범", "하르봉", "하르범");
        assertThat(detail.hint()).isEqualTo("힌트 1");
    }

    @Test
    void 주관식_선택지와_없는_이미지_힌트는_null로_둔다() {
        QuizDetail detail = StartCultureMissionResponse.of(progress,
                List.of(shortAnswerQuiz(cultureMission, 1)), false).quizDetails().getFirst();

        assertThat(detail.options()).isNull();
        assertThat(detail.imgUrl()).isNull();
        assertThat(detail.hint()).isNull();
    }

    @Test
    void 문제_항목에_정답과_해설을_담지_않는다() {
        assertThat(QuizDetail.class.getRecordComponents())
                .extracting(java.lang.reflect.RecordComponent::getName)
                .containsExactly("quizIndex", "imgUrl", "question", "options", "hint")
                .doesNotContain("answer", "explanation");
    }
}
