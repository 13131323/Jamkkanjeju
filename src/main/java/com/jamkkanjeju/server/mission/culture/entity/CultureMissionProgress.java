package com.jamkkanjeju.server.mission.culture.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import com.jamkkanjeju.server.mission.common.entity.MissionProgressStatus;
import com.jamkkanjeju.server.user.entity.User;
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

    public void moveToNextQuiz(boolean correct) {
        this.currentQuizIndex++;
        if (correct) {
            this.correctCount++;
        }
    }

    public void complete(LocalDateTime completedAt) {
        this.missionStatus = MissionProgressStatus.COMPLETED;
        this.lastCompletedAt = completedAt;
    }
}
