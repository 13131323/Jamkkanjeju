package com.jamkkanjeju.server.mission.treasure.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 보물찾기 아이템별 발견 여부 (PK: treasure_mission_progress_id, item_index) */
@Entity
@Getter
@Table(name = "treasure_mission_progress_item")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TreasureMissionProgressItem extends BaseTimeEntity {

    @EmbeddedId
    private TreasureMissionProgressItemId id;

    @MapsId("treasureMissionProgressId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "treasure_mission_progress_id", nullable = false)
    private TreasureMissionProgress treasureMissionProgress;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_status", nullable = false, length = 20)
    private TreasureItemStatus itemStatus;

    @Column(name = "found_at")
    private LocalDateTime foundAt;

    @Builder
    private TreasureMissionProgressItem(TreasureMissionProgress treasureMissionProgress,
                                        Integer itemIndex, TreasureItemStatus itemStatus,
                                        LocalDateTime foundAt) {
        this.id = new TreasureMissionProgressItemId(treasureMissionProgress.getId(), itemIndex);
        this.treasureMissionProgress = treasureMissionProgress;
        this.itemStatus = itemStatus == null ? TreasureItemStatus.UNFOUND : itemStatus;
        this.foundAt = foundAt;
    }

    public Integer getItemIndex() {
        return id.getItemIndex();
    }

    public void markFound(LocalDateTime foundAt) {
        this.itemStatus = TreasureItemStatus.FOUND;
        this.foundAt = foundAt;
    }
}
