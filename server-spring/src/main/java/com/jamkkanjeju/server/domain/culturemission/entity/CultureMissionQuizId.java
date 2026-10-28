package com.jamkkanjeju.server.domain.culturemission.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 문화 미션 퀴즈를 문화 미션과 퀴즈 순번으로 식별하는 복합 키이다. */
@Embeddable
@Getter
@EqualsAndHashCode
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class CultureMissionQuizId implements Serializable {

    @Column(name = "culture_mission_id")
    private Long cultureMissionId;

    @Column(name = "quiz_index")
    private Integer quizIndex;
}
