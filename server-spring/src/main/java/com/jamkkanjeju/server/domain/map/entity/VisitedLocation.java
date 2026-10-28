package com.jamkkanjeju.server.domain.map.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import com.jamkkanjeju.server.domain.auth.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 사용자가 방문한 관광지와 마지막 방문 시각을 나타내는 방문 기록이다. 사용자와 장소 조합당 한 건이다. */
@Entity
@Getter
@Table(
        name = "visited_location",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_visited_location_user_location",
                columnNames = {"user_id", "location_id"})
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class VisitedLocation extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "location_id", nullable = false)
    private Location location;

    @Column(name = "last_visited_at", nullable = false)
    private LocalDateTime lastVisitedAt;

    /** 같은 장소를 다시 방문했을 때 마지막 방문 시각을 갱신한다. */
    public void updateLastVisitedAt(LocalDateTime visitedAt) {
        this.lastVisitedAt = visitedAt;
    }
}
