package com.jamkkanjeju.server.domain.mypage.entity;

import com.jamkkanjeju.server.domain.auth.entity.User;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@Table(name = "user_setting")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserSetting extends BaseTimeEntity {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "push_notification", nullable = false)
    private boolean pushNotification = true;

    @Column(name = "near_mission_notification", nullable = false)
    private boolean nearMissionNotification = true;

    @Builder
    private UserSetting(User user, Boolean pushNotification, Boolean nearMissionNotification) {
        this.user = user;
        this.pushNotification = pushNotification == null || pushNotification;
        this.nearMissionNotification = nearMissionNotification == null || nearMissionNotification;
    }

    public void update(boolean pushNotification, boolean nearMissionNotification) {
        this.pushNotification = pushNotification;
        this.nearMissionNotification = nearMissionNotification;
    }
}
