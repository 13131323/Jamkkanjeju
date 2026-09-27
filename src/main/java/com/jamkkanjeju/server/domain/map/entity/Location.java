package com.jamkkanjeju.server.domain.map.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@Table(
        name = "location",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_location_content_id", columnNames = "content_id")
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class Location extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    /** 한국관광공사 TourAPI contentId */
    @Column(name = "content_id", nullable = false)
    private Long contentId;

    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Column(name = "address", nullable = false, length = 255)
    private String address;

    @Column(name = "category", nullable = false, length = 20)
    private String category;

    /** 방문 인정 반경 (m) */
    @Column(name = "radius", nullable = false)
    private int radius;

    @Column(name = "latitude", nullable = false)
    private double latitude;

    @Column(name = "longitude", nullable = false)
    private double longitude;
}
