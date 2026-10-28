package com.jamkkanjeju.server.common.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import java.time.LocalDateTime;
import lombok.Getter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** 엔티티의 생성·수정 시각을 공통으로 관리하는 상위 매핑 클래스이다. */
// DB에도 DEFAULT CURRENT_TIMESTAMP / ON UPDATE CURRENT_TIMESTAMP 가 걸려 있지만, JPA를 통해 들어오는 쓰기는 Auditing이 값을 채운다.
@Getter
@MappedSuperclass       // JPA Entity 클래스들이 BaseTimeEntity를 상속할 경우, 필드(createdAt, updatedAt)들도 칼럼으로 인식하도록 한다.
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseTimeEntity {

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
