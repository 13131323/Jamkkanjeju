package com.jamkkanjeju.server.domain.culturemission.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

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
