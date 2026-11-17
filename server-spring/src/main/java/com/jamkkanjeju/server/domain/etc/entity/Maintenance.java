package com.jamkkanjeju.server.domain.etc.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 홈에 표시할 점검 공지와 점검 예약·실행 상태를 보관한다. */
@Entity
@Getter
@Table(name = "maintenance")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Maintenance extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "message", nullable = false, length = 500)
    private String message;

    @Column(name = "starts_at", nullable = false)
    private LocalDateTime startsAt;

    @Column(name = "ends_at", nullable = false)
    private LocalDateTime endsAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private MaintenanceStatus status;

    /** 공지와 점검 일정을 생성하며 상태를 생략하면 예약 상태로 저장한다. */
    @Builder
    private Maintenance(String message, LocalDateTime startsAt, LocalDateTime endsAt,
                        MaintenanceStatus status) {
        this.message = message;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.status = status == null ? MaintenanceStatus.SCHEDULED : status;
    }
}
