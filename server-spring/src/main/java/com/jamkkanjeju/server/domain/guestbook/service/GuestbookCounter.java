package com.jamkkanjeju.server.domain.guestbook.service;

import com.jamkkanjeju.server.domain.guestbook.repository.GuestbookRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** 서비스에 쌓인 방명록 개수를 집계한다. */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GuestbookCounter {

    private final GuestbookRepository guestbookRepository;

    /** 서비스 전체 사용자가 남긴 방명록 개수를 센다. */
    // TODO: 추후 기획상 집계 기준이 확정되면 현재 전체 개수 집계 로직을 확정된 기준으로 교체한다.
    public long countAll() {
        return guestbookRepository.count();
    }
}
