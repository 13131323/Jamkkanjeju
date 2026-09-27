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
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

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

    @Builder
    private User(OnboardingResult onboardingResult, String nickname, Integer point,
                 Integer targetStep, String email, String passwordHash,
                 UserRole role, UserStatus status) {
        this.onboardingResult = onboardingResult;
        this.nickname = nickname;
        this.point = point == null ? 0 : point;
        this.targetStep = targetStep == null ? 10000 : targetStep;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role == null ? UserRole.USER : role;
        this.status = status == null ? UserStatus.ACTIVE : status;
    }
}
