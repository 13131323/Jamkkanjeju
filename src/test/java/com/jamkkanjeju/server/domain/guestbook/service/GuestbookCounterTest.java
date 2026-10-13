package com.jamkkanjeju.server.domain.guestbook.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import com.jamkkanjeju.server.domain.guestbook.repository.GuestbookRepository;
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

    @BeforeEach
    void setUp() {
        guestbookCounter = new GuestbookCounter(guestbookRepository);
    }

    @Test
    void 사용자_조건_없이_공통_방명록_전체_개수를_반환한다() {
        given(guestbookRepository.count()).willReturn(42L);

        assertThat(guestbookCounter.countAll()).isEqualTo(42L);

        verify(guestbookRepository).count();
        verifyNoMoreInteractions(guestbookRepository);
    }

    @Test
    void 방명록이_없으면_0을_반환한다() {
        given(guestbookRepository.count()).willReturn(0L);

        assertThat(guestbookCounter.countAll()).isZero();
    }
}
