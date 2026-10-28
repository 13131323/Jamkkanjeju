package com.jamkkanjeju.server.domain.culturemission.entity;

import com.jamkkanjeju.server.domain.mission.entity.Mission;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
import com.jamkkanjeju.server.domain.auth.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 사용자가 문화 미션 퀴즈를 어디까지 풀었고 몇 개 맞혔는지 나타내는 진행 기록이다. 사용자당 미션별 한 건이다. */
@Entity
@Getter
@Table(
        name = "culture_mission_progress",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_culture_mission_progress_mission_user",
                columnNames = {"culture_mission_id", "user_id"})
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CultureMissionProgress extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "culture_mission_id", nullable = false)
    private CultureMission cultureMission;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "mission_status", nullable = false, length = 20)
    private MissionProgressStatus missionStatus;

    @Column(name = "current_quiz_index", nullable = false)
    private int currentQuizIndex = 1;

    @Column(name = "correct_count", nullable = false)
    private int correctCount;

    @Column(name = "last_completed_at")
    private LocalDateTime lastCompletedAt;

    /** 문화 미션 진행 기록을 생성한다. 값을 주지 않으면 첫 번째 퀴즈부터 진행 중 상태로 시작한다. */
    @Builder
    private CultureMissionProgress(CultureMission cultureMission, User user,
                                   MissionProgressStatus missionStatus,
                                   Integer currentQuizIndex, Integer correctCount,
                                   LocalDateTime lastCompletedAt) {
        this.cultureMission = cultureMission;
        this.user = user;
        this.missionStatus = missionStatus == null ? MissionProgressStatus.IN_PROGRESS : missionStatus;
        this.currentQuizIndex = currentQuizIndex == null ? 1 : currentQuizIndex;
        this.correctCount = correctCount == null ? 0 : correctCount;
        this.lastCompletedAt = lastCompletedAt;
    }

    /** 다음 퀴즈로 넘어가고, 정답을 맞혔으면 정답 수를 늘린다. */
    public void moveToNextQuiz(boolean correct) {
        this.currentQuizIndex++;
        if (correct) {
            this.correctCount++;
        }
    }

    /** 문화 미션 진행을 완료 처리하고 완료 시각을 기록한다. */
    public void complete(LocalDateTime completedAt) {
        this.missionStatus = MissionProgressStatus.COMPLETED;
        this.lastCompletedAt = completedAt;
    }

    /** 마지막 퀴즈의 채점 결과를 반영해 문화 미션을 완료한다. 퀴즈 번호는 마지막 번호를 유지한다. */
    public void completeLastQuiz(boolean correct, LocalDateTime completedAt) {
        if (correct) {
            this.correctCount++;
        }
        complete(completedAt);
    }

    /** 완료한 문화 미션을 첫 퀴즈부터 다시 풀 수 있게 진행 상태를 되돌린다. */
    public void restart() {
        this.missionStatus = MissionProgressStatus.IN_PROGRESS;
        this.currentQuizIndex = 1;
        this.correctCount = 0;
        // 마지막 완료 시각은 이전 완료 기록이므로 재시작해도 지우지 않는다.
    }
}
