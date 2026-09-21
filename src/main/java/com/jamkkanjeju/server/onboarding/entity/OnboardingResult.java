package com.jamkkanjeju.server.onboarding.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.List;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Getter
@Table(name = "onboarding_result")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class OnboardingResult extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_type", nullable = false, length = 20)
    private String userType;

    @Column(name = "type_description", nullable = false, length = 200)
    private String typeDescription;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "hashtags", nullable = false)
    private List<String> hashtags;

    @Column(name = "profile_img_url", nullable = false, length = 500)
    private String profileImgUrl;
}
