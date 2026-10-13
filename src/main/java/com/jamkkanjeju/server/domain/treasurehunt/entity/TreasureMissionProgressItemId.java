package com.jamkkanjeju.server.domain.treasurehunt.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 보물 아이템 발견 기록을 진행 기록과 아이템 순번으로 식별하는 복합 키이다. */
@Embeddable
@Getter
@EqualsAndHashCode
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class TreasureMissionProgressItemId implements Serializable {

    @Column(name = "treasure_mission_progress_id")
    private Long treasureMissionProgressId;

    @Column(name = "item_index")
    private Integer itemIndex;
}
