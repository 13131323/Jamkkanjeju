package com.jamkkanjeju.server.user.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import com.jamkkanjeju.server.onboarding.entity.OnboardingResult;
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
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Getter
@Table(
        name = "user",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_user_access_token_hash", columnNames = "access_token_hash")
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class User extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "onboarding_result_id", nullable = false)
    private OnboardingResult onboardingResult;

    @Column(name = "nickname", length = 20)
    private String nickname;

    @Column(name = "point", nullable = false)
    private int point;

    @Column(name = "target_step", nullable = false)
    private int targetStep;

    /** SHA-256 hex, CHAR(64) */
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "access_token_hash", nullable = false, length = 64)
    private String accessTokenHash;
}
