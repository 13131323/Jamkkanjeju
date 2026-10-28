package com.jamkkanjeju.server.domain.guestbook.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import com.jamkkanjeju.server.domain.guestbook.repository.GuestbookRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class GuestbookCounterTest {

    @Mock
    private GuestbookRepository guestbookRepository;

    private GuestbookCounter guestbookCounter;
    private static final LocalDateTime AFTER = LocalDateTime.of(2026, 10, 27, 12, 0);
    private static final LocalDateTime UNTIL = LocalDateTime.of(2026, 10, 28, 12, 0);

    @BeforeEach
    void setUp() {
        guestbookCounter = new GuestbookCounter(guestbookRepository, Clock.fixed(Instant.parse("2026-10-28T03:00:00Z"), ZoneOffset.UTC));
    }

    @Test
    void 마지막확인과_서버현재시각을_조건으로_개수를_반환한다() {
        given(guestbookRepository.countByCreatedAtGreaterThanAndCreatedAtLessThanEqual(AFTER, UNTIL)).willReturn(42L);

        assertThat(guestbookCounter.countSince(AFTER)).isEqualTo(42L);

        verify(guestbookRepository).countByCreatedAtGreaterThanAndCreatedAtLessThanEqual(AFTER, UNTIL);
        verifyNoMoreInteractions(guestbookRepository);
    }

    @Test
    void 방명록이_없으면_0을_반환한다() {
        given(guestbookRepository.countByCreatedAtGreaterThanAndCreatedAtLessThanEqual(AFTER, UNTIL)).willReturn(0L);

        assertThat(guestbookCounter.countSince(AFTER)).isZero();
    }
}
