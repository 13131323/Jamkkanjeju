package com.jamkkanjeju.server.domain.treasurehunt.entity;

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
@Table(name = "ar_character")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class ArCharacter extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "name", nullable = false, length = 50)
    private String name;

    @Column(name = "description", nullable = false, length = 200)
    private String description;

    @Column(name = "story_title", nullable = false, length = 200)
    private String storyTitle;

    @Column(name = "acquire_condition", nullable = false, length = 200)
    private String acquireCondition;

    @Column(name = "img_url", nullable = false, length = 500)
    private String imgUrl;

    @Column(name = "representative_color", nullable = false, length = 20)
    private String representativeColor;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "hashtags", nullable = false)
    private List<String> hashtags;
}
