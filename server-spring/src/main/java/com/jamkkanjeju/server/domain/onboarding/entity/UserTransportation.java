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

/** 사용자가 온보딩에서 선택한 이동 수단을 나타낸다. 사용자당 하나만 가진다. */
@Entity
@Getter
@Table(name = "user_transportation")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserTransportation extends BaseTimeEntity {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "transportation_id", nullable = false)
    private Transportation transportation;

    /** 사용자와 이동 수단으로 선택 내역을 생성한다. */
    @Builder
    private UserTransportation(User user, Transportation transportation) {
        this.user = user;
        this.transportation = transportation;
    }

    /** 사용자가 선택한 이동 수단을 변경한다. */
    public void changeTransportation(Transportation transportation) {
        this.transportation = transportation;
    }
}
