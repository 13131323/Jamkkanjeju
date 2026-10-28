package com.jamkkanjeju.server.domain.guestbook.service;

import com.jamkkanjeju.server.domain.guestbook.repository.GuestbookRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** 서비스에 쌓인 방명록 개수를 집계한다. */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GuestbookCounter {

    private final GuestbookRepository guestbookRepository;
    private final Clock clock;

    /** 마지막 확인 이후부터 서버 현재 시각까지 새로 생성된 방명록 개수를 센다. */
    public long countSince(LocalDateTime lastCheckedAt) {
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneId.of("Asia/Seoul"));
        return guestbookRepository.countByCreatedAtGreaterThanAndCreatedAtLessThanEqual(lastCheckedAt, now);
    }
}
