package com.jamkkanjeju.server.domain.treasurehunt.entity;

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

/**
 * 보물찾기 진행 기록 안에서 보물 아이템 하나의 발견 여부와 발견 시각을 나타낸다.
 * 진행 기록과 아이템 순번 조합으로 식별한다.
 */
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

    /** 보물 아이템의 발견 기록을 생성한다. 상태를 지정하지 않으면 미발견으로 시작한다. */
    @Builder
    private TreasureMissionProgressItem(TreasureMissionProgress treasureMissionProgress,
                                        Integer itemIndex, TreasureItemStatus itemStatus,
                                        LocalDateTime foundAt) {
        this.id = new TreasureMissionProgressItemId(treasureMissionProgress.getId(), itemIndex);
        this.treasureMissionProgress = treasureMissionProgress;
        this.itemStatus = itemStatus == null ? TreasureItemStatus.UNFOUND : itemStatus;
        this.foundAt = foundAt;
    }

    /** 진행 기록 안에서 이 보물 아이템의 순번을 반환한다. */
    public Integer getItemIndex() {
        return id.getItemIndex();
    }

    /** 보물 아이템을 찾은 상태로 바꾸고 발견 시각을 기록한다. */
    public void markFound(LocalDateTime foundAt) {
        this.itemStatus = TreasureItemStatus.FOUND;
        this.foundAt = foundAt;
    }
}
