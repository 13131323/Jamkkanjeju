package com.jamkkanjeju.server.domain.culturemission.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionProgress;
import com.jamkkanjeju.server.domain.culturemission.entity.CultureMissionQuiz;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/** 문화 미션 시작/이어하기 응답. 현재 진행도와 다음에 풀 퀴즈 번호, 전체 문제 목록을 담는다. */
public record StartCultureMissionResponse(
        Long cultureMissionProgressId,
        int quizCount,
        int currentQuizNumber,
        List<QuizDetail> quizDetails,
        /** 진행도를 새로 만들었는지 여부. 컨트롤러가 201/200 응답 상태를 정하는 데만 쓴다. */
        @JsonIgnore @Schema(hidden = true) boolean created
) {

    /** 진행도와 퀴즈 번호 오름차순으로 정렬된 퀴즈 목록으로 응답을 만든다. */
    public static StartCultureMissionResponse of(CultureMissionProgress progress, List<CultureMissionQuiz> quizzes,
                                                 boolean created) {
        return new StartCultureMissionResponse(
                progress.getId(),
                quizzes.size(),
                progress.getCurrentQuizIndex(),
                quizzes.stream().map(QuizDetail::from).toList(),
                created
        );
    }

    /** 사용자가 풀 문화 미션 문제 한 건. 정답과 해설은 채점 전이므로 담지 않는다. */
    public record QuizDetail(
            int quizIndex,
            String imgUrl,
            String question,
            List<String> options,
            String hint
    ) {

        /** 퀴즈 엔티티로 문제 항목을 만든다. 주관식이면 선택지는 null이다. */
        public static QuizDetail from(CultureMissionQuiz quiz) {
            return new QuizDetail(
                    quiz.getQuizIndex(),
                    quiz.getImgUrl(),
                    quiz.getQuestion(),
                    quiz.getOptions() != null ? List.copyOf(quiz.getOptions()) : null,
                    quiz.getHint()
            );
        }
    }
}
