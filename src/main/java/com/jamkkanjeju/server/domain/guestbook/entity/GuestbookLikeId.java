package com.jamkkanjeju.server.domain.guestbook.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 방명록 좋아요를 방명록과 사용자로 식별하는 복합 키이다. */
@Embeddable
@Getter
@EqualsAndHashCode
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class GuestbookLikeId implements Serializable {

    @Column(name = "guestbook_id")
    private Long guestbookId;

    @Column(name = "user_id")
    private Long userId;
}
