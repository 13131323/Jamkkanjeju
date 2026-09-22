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

/** user - expectation N:M 연결 테이블 (PK: user_id, expectation_id) */
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

    @Builder
    private UserExpectation(User user, Expectation expectation) {
        this.id = new UserExpectationId(user.getId(), expectation.getId());
        this.user = user;
        this.expectation = expectation;
    }
}
