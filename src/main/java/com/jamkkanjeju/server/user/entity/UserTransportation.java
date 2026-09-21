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

/** PK가 user_id 단일이라 사용자당 이동수단 1개만 가진다. */
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

    @Builder
    private UserTransportation(User user, Transportation transportation) {
        this.user = user;
        this.transportation = transportation;
    }

    public void changeTransportation(Transportation transportation) {
        this.transportation = transportation;
    }
}
