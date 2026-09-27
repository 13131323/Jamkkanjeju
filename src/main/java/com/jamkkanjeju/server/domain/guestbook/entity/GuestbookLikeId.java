package com.jamkkanjeju.server.domain.guestbook.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

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
