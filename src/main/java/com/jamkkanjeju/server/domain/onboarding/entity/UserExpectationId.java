package com.jamkkanjeju.server.domain.onboarding.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 사용자 여행 기대 항목의 복합 키(사용자·여행 기대 항목)이다. */
@Embeddable
@Getter
@EqualsAndHashCode
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class UserExpectationId implements Serializable {

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "expectation_id")
    private Long expectationId;
}
