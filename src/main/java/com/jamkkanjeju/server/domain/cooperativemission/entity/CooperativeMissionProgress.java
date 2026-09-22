package com.jamkkanjeju.server.domain.cooperativemission.entity;

import com.jamkkanjeju.server.domain.mission.entity.Mission;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import com.jamkkanjeju.server.domain.mission.entity.MissionProgressStatus;
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

/** 팀 단위 협동 미션 진행 상태. team_token 으로 팀원이 합류한다. */
@Entity
@Getter
@Table(
        name = "cooperative_mission_progress",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_cooperative_mission_progress_team_token", columnNames = "team_token")
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CooperativeMissionProgress extends BaseTimeEntity {

    public static final int FIRST_STEP = 1;
    public static final int LAST_STEP = 3;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cooperative_mission_id", nullable = false)
    private CooperativeMission cooperativeMission;

    /** 1, 2, 3 만 허용 */
    @Column(name = "current_step", nullable = false)
    private int currentStep = FIRST_STEP;

    @Enumerated(EnumType.STRING)
    @Column(name = "mission_status", nullable = false, length = 20)
    private MissionProgressStatus missionStatus;

    @Column(name = "team_token", nullable = false, length = 100)
    private String teamToken;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Builder
    private CooperativeMissionProgress(CooperativeMission cooperativeMission, Integer currentStep,
                                       MissionProgressStatus missionStatus, String teamToken,
                                       LocalDateTime completedAt) {
        this.cooperativeMission = cooperativeMission;
        this.currentStep = currentStep == null ? FIRST_STEP : currentStep;
        this.missionStatus = missionStatus == null ? MissionProgressStatus.IN_PROGRESS : missionStatus;
        this.teamToken = teamToken;
        this.completedAt = completedAt;
    }

    public void moveToNextStep() {
        if (currentStep < LAST_STEP) {
            this.currentStep++;
        }
    }

    public void complete(LocalDateTime completedAt) {
        this.missionStatus = MissionProgressStatus.COMPLETED;
        this.completedAt = completedAt;
    }
}
