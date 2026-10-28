package com.jamkkanjeju.server.domain.home.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import com.jamkkanjeju.server.domain.auth.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 사용자가 하루 걸음 수 목표를 달성해 받은 보상 지급 기록이다. 사용자와 날짜 조합당 한 건이다. */
@Entity
@Getter
@Table(name = "step_reward")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StepReward extends BaseTimeEntity {

    @EmbeddedId
    private StepRewardId id;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "rewarded_at", nullable = false)
    private LocalDateTime rewardedAt;

    @Column(name = "steps_count", nullable = false)
    private int stepsCount;

    /** 특정 날짜의 걸음 수 보상 지급 기록을 생성한다. */
    @Builder
    private StepReward(User user, LocalDate rewardDate, LocalDateTime rewardedAt, int stepsCount) {
        this.id = new StepRewardId(user.getId(), rewardDate);
        this.user = user;
        this.rewardedAt = rewardedAt;
        this.stepsCount = stepsCount;
    }

    /** 보상 지급 기준 날짜를 반환한다. */
    public LocalDate getRewardDate() {
        return id.getRewardDate();
    }
}
