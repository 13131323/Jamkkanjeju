package com.jamkkanjeju.server.domain.onboarding.entity;

import com.jamkkanjeju.server.domain.auth.entity.User;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 사용자가 온보딩에서 선택한 여행 기대 항목을 나타낸다. 사용자당 여러 개를 가질 수 있다. */
@Entity
@Getter
@Table(name = "user_expectation")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserExpectation extends BaseTimeEntity {

    @EmbeddedId
    private UserExpectationId id;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @MapsId("expectationId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "expectation_id", nullable = false)
    private Expectation expectation;

    /** 사용자와 여행 기대 항목으로 선택 내역을 생성한다. */
    @Builder
    private UserExpectation(User user, Expectation expectation) {
        this.id = new UserExpectationId(user.getId(), expectation.getId());
        this.user = user;
        this.expectation = expectation;
    }
}
