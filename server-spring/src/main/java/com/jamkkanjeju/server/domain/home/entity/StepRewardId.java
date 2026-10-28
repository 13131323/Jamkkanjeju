package com.jamkkanjeju.server.domain.home.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 걸음 수 보상 지급 기록을 사용자와 날짜로 식별하는 복합 키이다. */
@Embeddable
@Getter
@EqualsAndHashCode
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class StepRewardId implements Serializable {

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "reward_date")
    private LocalDate rewardDate;
}
