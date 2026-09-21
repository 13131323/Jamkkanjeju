package com.jamkkanjeju.server.guestbook.entity;

import com.jamkkanjeju.server.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * 방명록 좋아요 (PK: guestbook_id, user_id).
 * 이 테이블만 updated_at 이 없어 BaseTimeEntity 를 상속하지 않는다.
 */
@Entity
@Getter
@Table(name = "guestbook_like")
@EntityListeners(AuditingEntityListener.class)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GuestbookLike {

    @EmbeddedId
    private GuestbookLikeId id;

    @MapsId("guestbookId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "guestbook_id", nullable = false)
    private Guestbook guestbook;

    @MapsId("userId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    private GuestbookLike(Guestbook guestbook, User user) {
        this.id = new GuestbookLikeId(guestbook.getId(), user.getId());
        this.guestbook = guestbook;
        this.user = user;
    }
}
