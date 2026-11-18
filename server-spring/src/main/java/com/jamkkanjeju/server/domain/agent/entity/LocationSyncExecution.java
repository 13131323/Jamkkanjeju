package com.jamkkanjeju.server.domain.agent.entity;

import com.jamkkanjeju.server.common.persistence.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

/** 승인된 동기화 요청의 동일성과 완료 결과를 영속 보관한다. */
@Entity
@Table(name = "agent_location_sync_execution")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class LocationSyncExecution extends BaseTimeEntity {
    public enum Status { PENDING, COMPLETED }

    @Id
    @Column(name = "request_id", length = 80)
    private String requestId;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "request_hash", length = 64, nullable = false)
    private String requestHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    private Status status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "added_content_ids", nullable = false)
    private List<Long> addedContentIds;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "deleted_content_ids", nullable = false)
    private List<Long> deletedContentIds;
}
