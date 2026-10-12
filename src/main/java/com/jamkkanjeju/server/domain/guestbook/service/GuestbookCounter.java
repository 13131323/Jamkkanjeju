package com.jamkkanjeju.server.domain.guestbook.service;

import com.jamkkanjeju.server.domain.guestbook.repository.GuestbookRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** 방명록 개수 집계. 집계 기준이 바뀔 수 있어 홈 서비스와 분리한다. (home BUISNESS_RULE.md 7절) */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GuestbookCounter {

    private final GuestbookRepository guestbookRepository;

    /** 서비스 전체 방명록 수. 공통 guestbook 행 기준이라 일반·길바닥 방명록을 모두 포함하고 중복 집계하지 않는다. */
    // TODO: 추후 기획상 집계 기준이 확정되면 현재 전체 개수 집계 로직을 확정된 기준으로 교체한다.
    public long countAll() {
        return guestbookRepository.count();
    }
}
