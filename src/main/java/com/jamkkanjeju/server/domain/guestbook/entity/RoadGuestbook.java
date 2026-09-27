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

/** guestbook 과 PK 를 공유하는 길 위 방명록 */
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

    @Builder
    private RoadGuestbook(Guestbook guestbook, String locationAlias,
                          double latitude, double longitude) {
        this.guestbook = guestbook;
        this.locationAlias = locationAlias;
        this.latitude = latitude;
        this.longitude = longitude;
    }
}
