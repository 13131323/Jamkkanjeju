package com.jamkkanjeju.server.user.entity;

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

/** PK가 user_id 단일이라 사용자당 여행 스타일 1개만 가진다. */
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

    @Builder
    private UserTravelStyle(User user, TravelStyle travelStyle) {
        this.user = user;
        this.travelStyle = travelStyle;
    }

    public void changeTravelStyle(TravelStyle travelStyle) {
        this.travelStyle = travelStyle;
    }
}
