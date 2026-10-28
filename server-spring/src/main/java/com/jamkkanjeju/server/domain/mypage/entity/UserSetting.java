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

/** 사용자의 알림 설정(푸시 알림, 주변 미션 알림)이다. 사용자와 PK를 공유한다. */
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

    /** 사용자 설정을 생성한다. 알림 값을 지정하지 않으면 켜진 상태로 시작한다. */
    @Builder
    private UserSetting(User user, Boolean pushNotification, Boolean nearMissionNotification) {
        this.user = user;
        this.pushNotification = pushNotification == null || pushNotification;
        this.nearMissionNotification = nearMissionNotification == null || nearMissionNotification;
    }

    /** 푸시 알림과 주변 미션 알림 설정을 변경한다. */
    public void update(boolean pushNotification, boolean nearMissionNotification) {
        this.pushNotification = pushNotification;
        this.nearMissionNotification = nearMissionNotification;
    }
}
