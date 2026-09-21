package com.jamkkanjeju.server.guestbook.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import com.jamkkanjeju.server.location.entity.VisitedLocation;
import com.jamkkanjeju.server.mission.common.entity.Mission;
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

/** guestbook 과 PK 를 공유하는 장소 방명록 */
@Entity
@Getter
@Table(name = "location_guestbook")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LocationGuestbook extends BaseTimeEntity {

    @Id
    @Column(name = "guestbook_id")
    private Long guestbookId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "guestbook_id", nullable = false)
    private Guestbook guestbook;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "visited_location_id")
    private VisitedLocation visitedLocation;

    /** 미션 수행 중 작성한 방명록이면 해당 미션 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mission_id")
    private Mission mission;

    @Builder
    private LocationGuestbook(Guestbook guestbook, VisitedLocation visitedLocation, Mission mission) {
        this.guestbook = guestbook;
        this.visitedLocation = visitedLocation;
        this.mission = mission;
    }
}
