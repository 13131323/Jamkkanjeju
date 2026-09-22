package com.jamkkanjeju.server.domain.cooperativemission.entity;

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

/** 협동 미션에서 팀원에게 배정되는 역할 카드 */
@Entity
@Getter
@Table(name = "cooperative_role_card")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class CooperativeRoleCard extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "role_name", nullable = false, length = 20)
    private String roleName;

    @Column(name = "role_description", nullable = false, length = 200)
    private String roleDescription;

    /** 찾아야 하는 사물/장소 목록 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "location_to_find", nullable = false)
    private List<String> locationToFind;
}
