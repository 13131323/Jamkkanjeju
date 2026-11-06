package com.jamkkanjeju.server.domain.mypage.dto;

import com.jamkkanjeju.server.domain.etc.entity.TravelEndingContent;

/** 생성된 엽서 식별자·Blob URL·차감 후 포인트이다. */
public record CreateTravelEndingContentResponse(Long id, String imageUrl, int remainingPoint) {
    /** 저장한 엽서와 실제 사용자 잔액으로 성공 응답을 만든다. */
    public static CreateTravelEndingContentResponse of(TravelEndingContent content, int remainingPoint) {
        return new CreateTravelEndingContentResponse(content.getId(), content.getImageUrl(), remainingPoint);
    }
}
