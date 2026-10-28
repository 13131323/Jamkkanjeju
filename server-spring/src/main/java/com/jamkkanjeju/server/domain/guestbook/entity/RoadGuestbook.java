package com.jamkkanjeju.server.domain.guestbook.entity;

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

/** 사용자가 직접 이름 붙인 길 위의 위치에 남기는 길바닥 방명록이다. 방명록 공통 내용({@link Guestbook})과 PK를 공유한다. */
@Entity
@Getter
@Table(name = "road_guestbook")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RoadGuestbook extends BaseTimeEntity {

    @Id
    @Column(name = "guestbook_id")
    private Long guestbookId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "guestbook_id", nullable = false)
    private Guestbook guestbook;

    /** 사용자가 직접 붙인 장소 이름 */
    @Column(name = "location_alias", nullable = false, length = 100)
    private String locationAlias;

    @Column(name = "latitude", nullable = false)
    private double latitude;

    @Column(name = "longitude", nullable = false)
    private double longitude;

    /** 길바닥 방명록을 생성한다. */
    @Builder
    private RoadGuestbook(Guestbook guestbook, String locationAlias,
                          double latitude, double longitude) {
        this.guestbook = guestbook;
        this.locationAlias = locationAlias;
        this.latitude = latitude;
        this.longitude = longitude;
    }
}
