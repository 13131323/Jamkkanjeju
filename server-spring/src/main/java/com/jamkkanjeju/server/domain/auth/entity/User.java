package com.jamkkanjeju.server.domain.auth.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import com.jamkkanjeju.server.domain.onboarding.entity.OnboardingResult;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 서비스 사용자 계정이다. */
@Entity
@Getter
@Table(
        name = "user",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_user_email", columnNames = "email")
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "onboarding_result_id")
    private OnboardingResult onboardingResult;

    @Column(name = "nickname", length = 20)
    private String nickname;

    @Column(name = "point", nullable = false)
    private int point;

    @Column(name = "target_step", nullable = false)
    private int targetStep;

    @Column(name = "email", nullable = false, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private UserRole role;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private UserStatus status;

    @Column(name = "guestbook_last_checked_at", nullable = false)
    private LocalDateTime guestbookLastCheckedAt;

    /** 사용자 계정을 생성하고, 지정하지 않은 값은 기본값으로 채운다. */
    @Builder
    private User(OnboardingResult onboardingResult, String nickname, Integer point,
                 Integer targetStep, String email, String passwordHash,
                 UserRole role, UserStatus status, LocalDateTime guestbookLastCheckedAt) {
        this.onboardingResult = onboardingResult;
        this.nickname = nickname;
        this.point = point == null ? 0 : point;
        this.targetStep = targetStep == null ? 10000 : targetStep;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role == null ? UserRole.USER : role;
        this.status = status == null ? UserStatus.ACTIVE : status;
        this.guestbookLastCheckedAt = guestbookLastCheckedAt;
    }

    /** 최초 저장 시 확인 시각을 지정하지 않았다면 Auditing이 기록한 계정 생성 시각으로 채운다. */
    @PrePersist
    private void initializeGuestbookLastCheckedAt() {
        if (guestbookLastCheckedAt == null) {
            guestbookLastCheckedAt = getCreatedAt();
        }
    }

    /** 방명록 목록을 마지막으로 확인한 시각을 갱신한다. */
    public void checkGuestbooks(LocalDateTime checkedAt) {
        this.guestbookLastCheckedAt = checkedAt;
    }

    /** 사용자에게 온보딩 결과를 배정한다. */
    // 기존 결과가 있으면 교체한다.
    public void assignOnboardingResult(OnboardingResult onboardingResult) {
        this.onboardingResult = onboardingResult;
    }

    /** 검증된 닉네임을 변경한다. */
    public void changeNickname(String nickname) {
        this.nickname = nickname;
    }

    /** 사용자가 설정한 하루 목표 걸음 수를 변경한다. */
    public void changeTargetStep(int targetStep) {
        this.targetStep = targetStep;
    }

    /** 보상으로 받은 포인트를 사용자 포인트에 누적한다. */
    public void addPoint(int point) {
        this.point += point;
    }
}
