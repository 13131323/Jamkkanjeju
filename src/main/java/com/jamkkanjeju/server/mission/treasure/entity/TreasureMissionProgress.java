package com.jamkkanjeju.server.mission.treasure.entity;

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
        name = "treasure_mission_progress",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_treasure_mission_progress_mission_user",
                columnNames = {"treasure_mission_id", "user_id"})
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TreasureMissionProgress extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "treasure_mission_id", nullable = false)
    private TreasureMission treasureMission;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "found_item_count", nullable = false)
    private int foundItemCount;

    @Enumerated(EnumType.STRING)
    @Column(name = "mission_status", nullable = false, length = 20)
    private MissionProgressStatus missionStatus;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Builder
    private TreasureMissionProgress(TreasureMission treasureMission, User user,
                                    Integer foundItemCount, MissionProgressStatus missionStatus,
                                    LocalDateTime completedAt) {
        this.treasureMission = treasureMission;
        this.user = user;
        this.foundItemCount = foundItemCount == null ? 0 : foundItemCount;
        this.missionStatus = missionStatus == null ? MissionProgressStatus.IN_PROGRESS : missionStatus;
        this.completedAt = completedAt;
    }

    public void increaseFoundItemCount() {
        this.foundItemCount++;
    }

    public void complete(LocalDateTime completedAt) {
        this.missionStatus = MissionProgressStatus.COMPLETED;
        this.completedAt = completedAt;
    }
}
