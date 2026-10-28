package com.jamkkanjeju.server.domain.guestbook.dto;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** 토글 결과의 공개 응답 필드와 등록·취소 후 개수를 검증한다. */
class ToggleGuestbookLikeResponseTest {
    @ParameterizedTest @CsvSource({"true,3", "false,0"})
    void 방명록ID와_처리후상태와_개수를_반환한다(boolean isLiked, long count) {
        ToggleGuestbookLikeResponse result = ToggleGuestbookLikeResponse.of(101L, isLiked, count);
        assertThat(result.guestbookId()).isEqualTo(101L);
        assertThat(result.isLiked()).isEqualTo(isLiked);
        assertThat(result.likeCount()).isEqualTo(count);
    }
}
