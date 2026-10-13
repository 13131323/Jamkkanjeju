package com.jamkkanjeju.server.domain.onboarding.entity;

import com.jamkkanjeju.server.domain.auth.entity.User;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 사용자가 온보딩에서 선택한 여행 방식을 나타낸다. 사용자당 하나만 가진다. */
@Entity
@Getter
@Table(name = "user_travel_style")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserTravelStyle extends BaseTimeEntity {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "travel_style_id", nullable = false)
    private TravelStyle travelStyle;

    /** 사용자와 여행 방식으로 선택 내역을 생성한다. */
    @Builder
    private UserTravelStyle(User user, TravelStyle travelStyle) {
        this.user = user;
        this.travelStyle = travelStyle;
    }

    /** 사용자가 선택한 여행 방식을 변경한다. */
    public void changeTravelStyle(TravelStyle travelStyle) {
        this.travelStyle = travelStyle;
    }
}
