package com.jamkkanjeju.server.domain.mypage.service;

import static com.jamkkanjeju.server.domain.auth.support.AuthFixtures.activeUser;
import static com.jamkkanjeju.server.domain.onboarding.support.OnboardingFixtures.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.jamkkanjeju.server.common.exception.CommonErrorCode;
import com.jamkkanjeju.server.domain.auth.entity.User;
import com.jamkkanjeju.server.domain.auth.repository.UserRepository;
import com.jamkkanjeju.server.domain.mypage.dto.UpdateUserInfoRequest;
import com.jamkkanjeju.server.domain.onboarding.entity.*;
import com.jamkkanjeju.server.domain.onboarding.repository.*;
import com.jamkkanjeju.server.domain.onboarding.service.OnboardingService;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.json.JsonMapper;

/** 변경되지 않은 값의 보존과 실제 선택 변경 분기를 격리한다. */
@ExtendWith(MockitoExtension.class)
class UpdateUserInfoServiceTest {
    @Mock UserRepository users;
    @Mock UserExpectationRepository expectations;
    @Mock UserTransportationRepository transportation;
    @Mock UserTravelStyleRepository travelStyle;
    @Mock OnboardingService onboarding;
    @InjectMocks MyPageService service;

    @Test
    void 없는사용자는인증오류이며_변경을중단한다() {
        assertThatThrownBy(() -> service.updateUserInfo(15L, UpdateUserInfoRequest.from(Map.of())))
                .extracting("errorCode").isEqualTo(CommonErrorCode.UNAUTHORIZED);
        verifyNoInteractions(expectations, transportation, travelStyle, onboarding);
    }

    @Test
    void 닉네임과목표만변경하면_선택조회와재배정을하지않는다() {
        User user = activeUser(15L);
        when(users.findById(15L)).thenReturn(Optional.of(user));
        service.updateUserInfo(15L, UpdateUserInfoRequest.from(Map.of("nickname", " 새이름 ", "targetStepCount", 12000)));
        assertThat(user.getNickname()).isEqualTo("새이름");
        assertThat(user.getTargetStep()).isEqualTo(12000);
        verifyNoInteractions(expectations, transportation, travelStyle, onboarding);
    }

    @Test
    void 빈객체는사용자값을그대로유지한다() {
        User user = activeUser(15L);
        String nickname = user.getNickname();
        when(users.findById(15L)).thenReturn(Optional.of(user));
        service.updateUserInfo(15L, UpdateUserInfoRequest.from(Map.of()));
        assertThat(user.getNickname()).isEqualTo(nickname);
        assertThat(user.getTargetStep()).isEqualTo(10000);
        verifyNoInteractions(expectations, transportation, travelStyle, onboarding);
    }

    @Test
    void 기대항목순서만바꾸면재배정하지않는다() {
        User user = savedSelections();
        service.updateUserInfo(15L, UpdateUserInfoRequest.from(Map.of("expectations", List.of("CAFE", "PHOTO"))));
        verifyNoInteractions(onboarding);
        assertThat(user.getId()).isEqualTo(15L);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"expectations\":[\"LOCAL\"]}", "{\"transportation\":null}", "{\"travelStyle\":\"NEAR_AROUND\"}"})
    void 변경한선택과생략한기존선택을합쳐재배정한다(String json) {
        User user = savedSelections();
        var request = JsonMapper.builder().build().readValue(json, UpdateUserInfoRequest.class);
        service.updateUserInfo(15L, request);
        verify(onboarding).updateSelectionsAndAssignResult(user,
                request.hasField("expectations") ? List.of(ExpectationType.LOCAL) : List.of(ExpectationType.PHOTO, ExpectationType.CAFE),
                request.hasField("transportation") ? null : TransportationType.WALK,
                request.hasField("travelStyle") ? TravelStyleType.NEAR_AROUND : TravelStyleType.RIGHT_HERE);
    }

    private User savedSelections() {
        User user = activeUser(15L);
        when(users.findById(15L)).thenReturn(Optional.of(user));
        when(expectations.findAllWithExpectationByUserId(15L)).thenReturn(List.of(
                userExpectation(user, ExpectationType.PHOTO), userExpectation(user, ExpectationType.CAFE)));
        when(transportation.findWithTransportationByUserId(15L)).thenReturn(Optional.of(
                UserTransportation.builder().user(user).transportation(transportation(TransportationType.WALK)).build()));
        when(travelStyle.findWithTravelStyleByUserId(15L)).thenReturn(Optional.of(
                UserTravelStyle.builder().user(user).travelStyle(travelStyle(TravelStyleType.RIGHT_HERE)).build()));
        return user;
    }
}
