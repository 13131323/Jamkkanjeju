package com.jamkkanjeju.server.domain.agent.dto;

import java.util.List;
import org.springframework.data.domain.Slice;

/** 감성 분석에 필요한 식별자와 텍스트만 반환한다. */
public record GetAgentGuestbooksResponse(List<GuestbookText> guestbooks, GuestbooksPage guestbooksPage) {
    /** 조회 결과와 페이지 정보를 변환한다. */
    public static GetAgentGuestbooksResponse from(Slice<GuestbookText> page) {
        return new GetAgentGuestbooksResponse(page.getContent(),
                new GuestbooksPage(page.getNumber(), page.getSize(), page.hasNext()));
    }
    /** 원문은 Python 분석 입력에만 사용하며 분석 스냅샷에는 보관하지 않는다. */
    public record GuestbookText(Long locationId, Long guestbookId, String text) {}
    /** 다음 페이지 조회 조건이다. */
    public record GuestbooksPage(int page, int size, boolean hasNext) {}
}
