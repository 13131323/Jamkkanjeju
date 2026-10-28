package com.jamkkanjeju.server.domain.culturemission.dto;

import jakarta.validation.constraints.NotNull;

/** 문화 미션 진행도 저장 요청 본문. 사용자가 제출한 퀴즈 번호와 답변을 담는다. */
public record SaveCultureMissionProgressRequest(
        @NotNull Integer quizIndex,
        /** 객관식도 선택지 번호가 아닌 선택한 문자열이며, 서버가 저장된 정답과 그대로 비교한다. */
        @NotNull String answer
) {
}
