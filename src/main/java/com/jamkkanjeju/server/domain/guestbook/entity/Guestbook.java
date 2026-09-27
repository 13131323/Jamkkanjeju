package com.jamkkanjeju.server.domain.guestbook.entity;

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
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 방명록 공통 정보. 장소 방명록/길 위 방명록은 guestbook_id 를 PK 로 공유하는
 * location_guestbook / road_guestbook 에 나뉘어 저장된다.
 */
@Entity
@Getter
@Table(name = "guestbook")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class Guestbook extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    /** 작성자가 탈퇴하면 NULL 이 된다 (ON DELETE SET NULL) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "visited_at", nullable = false)
    private LocalDate visitedAt;

    @Column(name = "content_img_url", length = 500)
    private String contentImgUrl;

    @Column(name = "content_writing", length = 500)
    private String contentWriting;

    @Column(name = "content_audio_url", length = 500)
    private String contentAudioUrl;

    @Column(name = "audio_title", length = 50)
    private String audioTitle;

    @Column(name = "content_weather", length = 20)
    private String contentWeather;

    @Column(name = "content_temperature_celsius", precision = 4, scale = 1)
    private BigDecimal contentTemperatureCelsius;

    @Column(name = "content_color_code", length = 20)
    private String contentColorCode;

    @Column(name = "saved_at", nullable = false)
    private LocalDateTime savedAt;

    @Column(name = "status", nullable = false, length = 20)
    private String status;
}
