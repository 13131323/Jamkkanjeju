package com.jamkkanjeju.server.domain.mypage.service;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.onboarding.repository.*;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

/** 사용자 확인과 선택 부재의 정상 처리를 검증한다. */
@ExtendWith(MockitoExtension.class)
class GetUserInfoServiceTest {
    @Mock UserRepository users;
    @Mock UserExpectationRepository expectations;
    @Mock UserTransportationRepository transportation;
    @Mock UserTravelStyleRepository travelStyle;
    @InjectMocks MyPageService service;

    @Test void 사용자가없으면_인증오류이며_선택조회를중단한다() {
        assertThatThrownBy(()->service.getUserInfo(15L)).extracting("errorCode").isEqualTo(CommonErrorCode.UNAUTHORIZED);
        verifyNoInteractions(expectations,transportation,travelStyle);
    }

    @Test void 인증사용자의선택을조회하며_빈선택은정상이고_사용자저장값을유지한다() {
        LocalDateTime checkedAt=LocalDateTime.of(2026,10,30,12,0);
        User user=User.builder().point(77).targetStep(12000).guestbookLastCheckedAt(checkedAt).build();
        when(users.findById(15L)).thenReturn(Optional.of(user));
        var response=service.getUserInfo(15L);
        verify(expectations).findAllWithExpectationByUserId(15L);
        verify(transportation).findWithTransportationByUserId(15L);
        verify(travelStyle).findWithTravelStyleByUserId(15L);
        assertThat(response.expectations()).isEmpty();
        assertThat(response.transportation()).isNull();
        assertThat(response.travelStyle()).isNull();
        assertThat(response.targetStepCount()).isEqualTo(12000);
        assertThat(user.getPoint()).isEqualTo(77);
        assertThat(user.getGuestbookLastCheckedAt()).isEqualTo(checkedAt);
        verify(users,never()).save(any());
    }
}
