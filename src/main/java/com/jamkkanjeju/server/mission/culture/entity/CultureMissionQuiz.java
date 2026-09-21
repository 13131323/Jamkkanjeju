package com.jamkkanjeju.server.mission.culture.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import java.util.List;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 문화 미션 퀴즈 (PK: culture_mission_id, quiz_index) */
@Entity
@Getter
@Table(name = "culture_mission_quiz")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CultureMissionQuiz extends BaseTimeEntity {

    @EmbeddedId
    private CultureMissionQuizId id;

    @MapsId("cultureMissionId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "culture_mission_id", nullable = false)
    private CultureMission cultureMission;

    @Column(name = "img_url", length = 500)
    private String imgUrl;

    @Column(name = "question", nullable = false, length = 500)
    private String question;

    /** 객관식 보기. 주관식이면 null */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "options")
    private List<String> options;

    @Column(name = "answer", nullable = false, length = 500)
    private String answer;

    @Column(name = "hint", length = 500)
    private String hint;

    @Column(name = "explanation", length = 500)
    private String explanation;

    @Builder
    private CultureMissionQuiz(CultureMission cultureMission, Integer quizIndex, String imgUrl,
                               String question, List<String> options, String answer,
                               String hint, String explanation) {
        this.id = new CultureMissionQuizId(cultureMission.getMissionId(), quizIndex);
        this.cultureMission = cultureMission;
        this.imgUrl = imgUrl;
        this.question = question;
        this.options = options;
        this.answer = answer;
        this.hint = hint;
        this.explanation = explanation;
    }

    public Integer getQuizIndex() {
        return id.getQuizIndex();
    }
}
