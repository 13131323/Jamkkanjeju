package com.jamkkanjeju.server.domain.treasurehunt.entity;

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

/** 사용자가 보물찾기 미션에서 보물을 몇 개 찾았는지와 완료 여부를 나타내는 진행 기록이다. */
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

    /** 보물찾기 진행 기록을 생성한다. 찾은 개수와 상태를 지정하지 않으면 0개, 진행 중으로 시작한다. */
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

    /** 기존 진행도 ID를 유지하면서 완료 상태와 찾은 개수를 초기화한다. */
    public void restart() {
        this.missionStatus = MissionProgressStatus.IN_PROGRESS;
        this.foundItemCount = 0;
        this.completedAt = null;
    }

    /** 보물을 하나 찾았을 때 찾은 보물 개수를 1 늘린다. */
    public void increaseFoundItemCount() {
        this.foundItemCount++;
    }

    /** 보물찾기 미션을 완료 상태로 바꾸고 완료 시각을 기록한다. */
    public void complete(LocalDateTime completedAt) {
        this.missionStatus = MissionProgressStatus.COMPLETED;
        this.completedAt = completedAt;
    }
}
